/**
 * End-to-end sync against a real Supabase-compatible backend (Postgres with the website's
 * migrations + PostgREST). Skipped unless these are set:
 *   SYNC_IT_URL   e.g. http://127.0.0.1:54321 (`supabase start` in the website repo)
 *   SYNC_IT_JWT   an access token for a test user (role "authenticated")
 *   SYNC_IT_USER  that user's id
 * Uses a throwaway user: it writes and deletes that user's logs.
 */
import http from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { syncOnce } from '@/features/sync/engine';
import { useSyncStore } from '@/features/sync/syncStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useBodyStore } from '@/features/body/bodyStore';
import { useNutritionStore } from '@/features/nutrition/nutritionStore';
import { emptySchedule, useWorkoutStore } from '@/features/workouts/workoutStore';
import { useUserStore, DEFAULT_TARGETS } from '@/features/profile/userStore';

jest.mock('@/features/account/supabase', () => ({ supabase: null }));

const BASE = process.env.SYNC_IT_URL;
const JWT = process.env.SYNC_IT_JWT;
const USER = process.env.SYNC_IT_USER ?? '';
const suite = BASE && JWT && USER ? describe : describe.skip;

/** The React Native test environment has no working fetch: a minimal one over node:http. */
const nodeFetch = (input: unknown, init: { method?: string; headers?: unknown; body?: unknown } = {}) =>
  new Promise<Response>((resolve, reject) => {
    const headers: Record<string, string> = {};
    const h = init.headers as
      { forEach?: (fn: (v: string, k: string) => void) => void } | Record<string, string> | undefined;
    if (h && typeof h.forEach === 'function')
      (h as { forEach: (fn: (v: string, k: string) => void) => void }).forEach((v, k) => (headers[k] = v));
    else if (h) Object.assign(headers, h);
    const req = http.request(String(input), { method: init.method ?? 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () =>
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
          text: async () => body,
          json: async () => JSON.parse(body),
        } as unknown as Response),
      );
    });
    req.on('error', reject);
    if (typeof init.body === 'string') req.write(init.body);
    req.end();
  });

const client = (): SupabaseClient =>
  createClient(BASE!, 'anon', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${JWT}` }, fetch: nodeFetch as typeof fetch },
  });

function freshPhone() {
  useWeightStore.setState({ entries: [] });
  useBodyStore.setState({ measurements: [], biaReports: [] });
  useNutritionStore.setState({ days: {}, foods: {} });
  useWorkoutStore.setState({ workouts: [], schedule: emptySchedule() });
  useUserStore.setState({
    name: '',
    gender: null,
    heightCm: null,
    age: null,
    activityLevel: null,
    goal: null,
    targets: DEFAULT_TARGETS,
    units: { weight: 'kg', height: 'cm' },
  });
  useSyncStore.setState({
    enabled: true,
    userId: USER,
    cursor: null,
    shadow: {},
    profileHash: null,
    lastSyncedAt: null,
  });
}

const rows = async (sb: SupabaseClient, table: string, columns = '*') => {
  const { data, error } = await sb.from(table).select(columns).eq('user_id', USER).order('client_id');
  if (error) throw error;
  return data as unknown as Record<string, unknown>[];
};

suite('sync against a real backend', () => {
  let sb: SupabaseClient;
  let web: SupabaseClient; // the website, acting as the same person

  beforeAll(async () => {
    sb = client();
    web = client();
    for (const t of ['weight_entries', 'measurement_entries', 'bia_reports', 'food_entries', 'workouts']) {
      await web.from(t).delete().eq('user_id', USER);
    }
    freshPhone();
  });

  it('1. first sync uploads the phone and merges the profile', async () => {
    useWeightStore.getState().addEntry(80.4, '2026-10-20');
    useBodyStore.getState().addMeasurements({ waist: 84, bicepsL: 35 }, '2026-10-20');
    useNutritionStore.getState().addEntry('2026-10-20', {
      meal: 'lunch',
      name: 'Pasta',
      brand: 'Barilla',
      quantity: 1,
      unit: 'serving',
      amount: 100,
      macros: { kcal: 356, protein: 12.5, carbs: 71, fat: 2 },
    });
    useWorkoutStore.getState().addWorkout(
      {
        id: 'wk-push',
        name: 'Push',
        duration: 40,
        exercises: [
          { id: 'e1', name: 'Bench', sets: 3, reps: '8', restTime: 90, executionTime: 45, type: 'exercise' },
        ],
      },
      [1, 4],
    );
    useUserStore.setState({ name: 'Giulia', gender: 'female', heightCm: 168, age: 30, goal: 'lose' });

    await syncOnce(sb, USER);

    expect(await rows(web, 'weight_entries', 'kg, day')).toEqual([{ kg: 80.4, day: '2026-10-20' }]);
    expect(await rows(web, 'measurement_entries', 'values')).toEqual([
      { values: { waist: 84, bicepsL: 35 } },
    ]);
    const [food] = await rows(web, 'food_entries', 'name, kcal, grams, extra');
    expect(food).toMatchObject({
      name: 'Pasta',
      kcal: 356,
      grams: 100,
      extra: { brand: 'Barilla', unit: 'serving' },
    });
    const [workout] = await rows(web, 'workouts', 'client_id, name, weekdays, data');
    expect(workout).toMatchObject({
      client_id: 'wk-push',
      name: 'Push',
      weekdays: [1, 4],
      data: { estimatedMinutes: 40 },
    });
    const { data: profile } = await web
      .from('profiles')
      .select('full_name, gender, height_cm, goal, target_kcal')
      .eq('id', USER)
      .single();
    expect(profile).toMatchObject({
      gender: 'female',
      height_cm: 168,
      goal: 'lose',
      target_kcal: DEFAULT_TARGETS.kcal,
    });
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  });

  it('2. changes made on the website arrive on the phone', async () => {
    await web.from('weight_entries').insert({ user_id: USER, day: '2026-10-22', kg: 79.6 });
    const foodId = useNutritionStore.getState().days['2026-10-20']![0]!.id;
    await web.from('food_entries').update({ kcal: 400 }).eq('user_id', USER).eq('client_id', foodId);
    await web.from('measurement_entries').delete().eq('user_id', USER);
    await web.from('profiles').update({ target_kcal: 1850 }).eq('id', USER);

    await syncOnce(sb, USER);

    expect(useWeightStore.getState().entries.map((e) => e.kg)).toEqual([80.4, 79.6]);
    expect(useNutritionStore.getState().days['2026-10-20']![0]!.macros.kcal).toBe(400);
    expect(useNutritionStore.getState().days['2026-10-20']![0]!.brand).toBe('Barilla');
    expect(useBodyStore.getState().measurements).toEqual([]);
    expect(useUserStore.getState().targets.kcal).toBe(1850);
  });

  it('3. phone deletes and edits reach the website; a quiet sync writes nothing', async () => {
    const first = useWeightStore.getState().entries[0]!;
    useWeightStore.getState().removeEntry(first.id);
    useWorkoutStore.getState().updateWorkout('wk-push', { name: 'Push A' }, [1, 3]);

    await syncOnce(sb, USER);

    expect((await rows(web, 'weight_entries', 'kg')).map((r) => r.kg)).toEqual([79.6]);
    expect(await rows(web, 'workouts', 'name, weekdays')).toEqual([{ name: 'Push A', weekdays: [1, 3] }]);

    const before = JSON.stringify(await rows(web, 'food_entries', 'client_id, updated_at'));
    const shadowBefore = JSON.stringify(useSyncStore.getState().shadow);
    await syncOnce(sb, USER);
    expect(JSON.stringify(await rows(web, 'food_entries', 'client_id, updated_at'))).toBe(before);
    expect(JSON.stringify(useSyncStore.getState().shadow)).toBe(shadowBefore);
  });

  it('3b. a deletion on the website after an incremental sync reaches the phone', async () => {
    expect(useSyncStore.getState().cursor).not.toBeNull(); // incremental: uses the deletion log
    await web.from('food_entries').delete().eq('user_id', USER);
    await syncOnce(sb, USER);
    expect(Object.values(useNutritionStore.getState().days).flat()).toEqual([]);
    expect((await rows(web, 'weight_entries')).length).toBe(1); // nothing else touched
  });

  it('4. a fresh phone gets everything back and deletes nothing online', async () => {
    freshPhone();
    await syncOnce(sb, USER);

    expect(useWeightStore.getState().entries.map((e) => e.kg)).toEqual([79.6]);
    expect(useWorkoutStore.getState().workouts.map((w) => w.name)).toEqual(['Push A']);
    expect(useWorkoutStore.getState().schedule[3]).toEqual(['wk-push']);
    expect(Object.values(useNutritionStore.getState().days).flat()).toEqual([]);
    expect(useUserStore.getState()).toMatchObject({ gender: 'female', heightCm: 168, age: 30 });
    expect((await rows(web, 'weight_entries')).length).toBe(1);
    expect((await rows(web, 'workouts')).length).toBe(1);
  });
});
