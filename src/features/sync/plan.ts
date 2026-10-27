import { fingerprint } from '@/features/sync/hash';

/**
 * Three-way merge for one table, without timestamps on the phone.
 *
 * `shadow` holds, per record id, the fingerprint of the version both sides agreed on at the last
 * sync. Against it:
 *   - a remote row whose fingerprint differs → changed on the website → written to the phone
 *     (the website wins when both sides changed the same record);
 *   - a remote deletion → deleted on the phone;
 *   - a phone record whose fingerprint differs (or is new) → sent;
 *   - an id in the shadow that the phone no longer has → deleted on the website.
 * Records the phone never synced are never deleted remotely, so a reinstall or a fresh device
 * merges instead of wiping.
 */
export interface TablePlan<W> {
  /** Remote versions to write on the phone. */
  localUpserts: W[];
  /** Ids to delete on the phone. */
  localDeletes: string[];
  /** Phone versions to send. */
  pushUpserts: W[];
  /** Ids to delete on the website. */
  pushDeletes: string[];
  /** The shadow once everything above has been done. */
  shadow: Record<string, string>;
}

export function planTable<W extends { client_id: string }>(input: {
  local: ReadonlyMap<string, W>;
  shadow: Readonly<Record<string, string>>;
  remote: readonly W[];
  remoteDeleted: readonly string[];
  /** Records the server would reject (out-of-range values…) are kept on the phone and not sent. */
  valid?: (w: W) => boolean;
}): TablePlan<W> {
  const shadow: Record<string, string> = { ...input.shadow };
  const working = new Map(input.local);
  const localUpserts: W[] = [];
  const localDeletes: string[] = [];
  const seenRemote = new Set<string>();

  for (const row of input.remote) {
    const id = row.client_id;
    seenRemote.add(id);
    const h = fingerprint(row);
    if (shadow[id] === h) continue; // our own write coming back, or nothing new
    const mine = working.get(id);
    if (!mine || fingerprint(mine) !== h) {
      localUpserts.push(row);
      working.set(id, row);
    }
    shadow[id] = h;
  }

  for (const id of input.remoteDeleted) {
    if (seenRemote.has(id)) continue; // deleted, then created again: the row wins
    if (working.has(id)) {
      localDeletes.push(id);
      working.delete(id);
    }
    delete shadow[id];
  }

  const pushUpserts: W[] = [];
  for (const [id, row] of working) {
    if (input.valid && !input.valid(row)) continue;
    const h = fingerprint(row);
    if (shadow[id] !== h) {
      pushUpserts.push(row);
      shadow[id] = h;
    }
  }

  const pushDeletes = Object.keys(shadow).filter((id) => !working.has(id));
  for (const id of pushDeletes) delete shadow[id];

  return { localUpserts, localDeletes, pushUpserts, pushDeletes, shadow };
}
