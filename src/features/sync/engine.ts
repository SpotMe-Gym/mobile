import type { SupabaseClient } from '@supabase/supabase-js';
import { fingerprint } from '@/features/sync/hash';
import { planTable } from '@/features/sync/plan';
import {
  applyRemote,
  localProfileWire,
  readLocal,
  readLocalProfile,
  type RemoteChanges,
} from '@/features/sync/local';
import { useSyncStore } from '@/features/sync/syncStore';
import {
  biaFromRow,
  biaToWire,
  biaValid,
  foodFromRow,
  foodToWire,
  foodValid,
  measurementFromRow,
  measurementToWire,
  measurementValid,
  mergeProfiles,
  profileFromWire,
  profileWireFromRow,
  SYNC_TABLES,
  weightFromRow,
  weightToWire,
  weightValid,
  workoutFromRow,
  workoutToWire,
  workoutValid,
  type SyncTable,
} from '@/features/sync/wire';

type Row = Record<string, unknown>;
type Wire = { client_id: string } & Row;

const PAGE = 1000;
const CHUNK = 400;
/** Re-read a little before the cursor: a slow transaction can commit an older timestamp late. */
const OVERLAP_MS = 2 * 60 * 1000;

const COLUMNS: Record<SyncTable, string> = {
  weight_entries: 'client_id, day, kg, created_at, updated_at',
  measurement_entries: 'client_id, day, values, created_at, updated_at',
  bia_reports: 'client_id, day, device, data, created_at, updated_at',
  food_entries: 'client_id, day, meal, name, grams, kcal, protein, carbs, fat, extra, created_at, updated_at',
  workouts: 'client_id, name, data, weekdays, updated_at',
};

/** Row as the server sends it → the same normalised wire the phone produces. */
const NORMALISE: Record<SyncTable, (r: Row) => Wire> = {
  weight_entries: (r) => weightToWire(weightFromRow(r)) as unknown as Wire,
  measurement_entries: (r) => measurementToWire(measurementFromRow(r)) as unknown as Wire,
  bia_reports: (r) => biaToWire(biaFromRow(r)) as unknown as Wire,
  food_entries: (r) => {
    const { day, entry } = foodFromRow(r);
    return foodToWire(entry, day) as unknown as Wire;
  },
  workouts: (r) => {
    const { workout, weekdays } = workoutFromRow(r);
    return workoutToWire(workout, weekdays) as unknown as Wire;
  },
};

const VALID: Record<SyncTable, (w: Wire) => boolean> = {
  weight_entries: (w) => weightValid(w as never),
  measurement_entries: (w) => measurementValid(w as never),
  bia_reports: (w) => biaValid(w as never),
  food_entries: (w) => foodValid(w as never),
  workouts: (w) => workoutValid(w as never),
};

const later = (a: string | null, b: unknown): string | null => {
  const tb = typeof b === 'string' ? Date.parse(b) : NaN;
  if (!Number.isFinite(tb)) return a;
  return a === null || tb > Date.parse(a) ? new Date(tb).toISOString() : a;
};

async function fetchChanged(sb: SupabaseClient, table: SyncTable, userId: string, since: string | null) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(COLUMNS[table]).eq('user_id', userId);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q
      .order('updated_at')
      .order('client_id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function fetchDeletions(sb: SupabaseClient, userId: string, since: string) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('sync_deletions')
      .select('table_name, client_id, deleted_at')
      .eq('user_id', userId)
      .gt('deleted_at', since)
      .order('deleted_at')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const chunks = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * One full sync for `userId`: pull what changed on the website (rows + deletions), apply it,
 * push what changed on the phone, then save the bookkeeping. Throws on network / server errors;
 * nothing is marked as synced unless it was written.
 */
export async function syncOnce(sb: SupabaseClient, userId: string): Promise<void> {
  const state = useSyncStore.getState();
  const since = state.cursor ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString() : null;
  let cursor = state.cursor;

  // 1. Pull.
  const remote: Partial<Record<SyncTable, Wire[]>> = {};
  for (const table of SYNC_TABLES) {
    const rows = await fetchChanged(sb, table, userId, since);
    for (const r of rows) cursor = later(cursor, r.updated_at);
    remote[table] = rows.map(NORMALISE[table]);
  }
  const deleted: Partial<Record<SyncTable, string[]>> = {};
  if (!since) {
    // Full read: the server's rows are complete, so anything synced before that's missing now
    // was deleted on the website (works even when the deletion log was never read).
    for (const table of SYNC_TABLES) {
      const present = new Set((remote[table] ?? []).map((w) => w.client_id));
      deleted[table] = Object.keys(state.shadow[table] ?? {}).filter((id) => !present.has(id));
    }
  } else {
    for (const r of await fetchDeletions(sb, userId, since)) {
      const table = r.table_name as SyncTable;
      (deleted[table] ??= []).push(String(r.client_id));
      cursor = later(cursor, r.deleted_at);
    }
  }
  const { data: profileRow, error: profileError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;

  // 2. Plan and apply on the phone.
  const local = readLocal();
  const plans = Object.fromEntries(
    SYNC_TABLES.map((table) => [
      table,
      planTable<Wire>({
        local: local[table],
        shadow: state.shadow[table] ?? {},
        remote: remote[table] ?? [],
        remoteDeleted: deleted[table] ?? [],
        valid: VALID[table],
      }),
    ]),
  ) as Record<SyncTable, ReturnType<typeof planTable<Wire>>>;

  const changes: RemoteChanges = {};
  for (const table of SYNC_TABLES) {
    changes[table] = { upserts: plans[table].localUpserts, deletes: plans[table].localDeletes };
  }

  const remoteProfile = profileWireFromRow(profileRow as Row);
  const localProfile = localProfileWire();
  let profileToApply: ReturnType<typeof profileFromWire> | undefined;
  let profileToPush: typeof localProfile | undefined;
  let profileHash = state.profileHash;
  if (profileHash === null) {
    const merged = mergeProfiles(localProfile, remoteProfile);
    if (fingerprint(merged) !== fingerprint(localProfile))
      profileToApply = profileFromWire(merged, readLocalProfile());
    if (fingerprint(merged) !== fingerprint(remoteProfile)) profileToPush = merged;
    profileHash = fingerprint(merged);
  } else if (fingerprint(remoteProfile) !== profileHash) {
    profileToApply = profileFromWire(remoteProfile, readLocalProfile()); // changed on the website: it wins
    profileHash = fingerprint(remoteProfile);
  } else if (fingerprint(localProfile) !== profileHash) {
    profileToPush = localProfile;
    profileHash = fingerprint(localProfile);
  }

  applyRemote(changes, profileToApply);

  // 3. Push.
  for (const table of SYNC_TABLES) {
    const { pushUpserts, pushDeletes } = plans[table];
    for (const part of chunks(pushUpserts, CHUNK)) {
      const { error } = await sb.from(table).upsert(
        part.map((w) => ({ ...w, user_id: userId })),
        { onConflict: 'user_id,client_id' },
      );
      if (error) throw error;
    }
    for (const part of chunks(pushDeletes, CHUNK)) {
      const { error } = await sb.from(table).delete().eq('user_id', userId).in('client_id', part);
      if (error) throw error;
    }
  }
  if (profileToPush) {
    const { error } = await sb.from('profiles').update(profileToPush).eq('id', userId);
    if (error) throw error;
  }

  // 4. Remember. (Skipped if sync was turned off or the account changed meanwhile.)
  const now = useSyncStore.getState();
  if (!now.enabled || now.userId !== userId) return;
  useSyncStore.setState({
    cursor,
    shadow: Object.fromEntries(SYNC_TABLES.map((t) => [t, plans[t].shadow])),
    profileHash,
    lastSyncedAt: new Date().toISOString(),
  });
}
