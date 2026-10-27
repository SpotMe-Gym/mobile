import { fingerprint } from '@/features/sync/hash';
import {
  biaFromRow,
  biaToWire,
  foodFromRow,
  foodToWire,
  measurementFromRow,
  measurementToWire,
  mergeProfiles,
  profileFromWire,
  profileToWire,
  profileWireFromRow,
  weightFromRow,
  weightToWire,
  workoutFromRow,
  workoutToWire,
  type LocalProfile,
} from '@/features/sync/wire';
import type { LogEntry } from '@/features/nutrition/nutritionStore';

/** What PostgREST would send back for a row we wrote (numbers, +00:00 timestamps, extra columns). */
const viaServer = <T extends object>(wire: T): Record<string, unknown> => {
  const json = JSON.parse(JSON.stringify(wire)) as Record<string, unknown>;
  if (typeof json.created_at === 'string') json.created_at = json.created_at.replace('.000Z', '+00:00');
  return { ...json, id: 'server-uuid', user_id: 'u1', updated_at: '2026-10-28T09:00:00+00:00' };
};

describe('round trips keep the same fingerprint', () => {
  it('weight', () => {
    const w = weightToWire({
      id: 'w1',
      day: '2026-10-20',
      kg: 80.123,
      createdAt: '2026-10-20T07:30:00.000Z',
    });
    expect(w.kg).toBe(80.12);
    expect(fingerprint(weightToWire(weightFromRow(viaServer(w))))).toBe(fingerprint(w));
  });

  it('measurements, dropping unknown keys', () => {
    const m = measurementToWire({
      id: 'm1',
      source: 'manual',
      day: '2026-10-20',
      createdAt: '2026-10-20T07:30:00.000Z',
      values: { waist: 82.46, bicepsL: 36, foo: 3 } as never,
    });
    expect(m.values).toEqual({ waist: 82.5, bicepsL: 36 });
    expect(fingerprint(measurementToWire(measurementFromRow(viaServer(m))))).toBe(fingerprint(m));
  });

  it('BIA', () => {
    const b = biaToWire({
      id: 'b1',
      source: 'bia',
      day: '2026-10-20',
      createdAt: '2026-10-20T07:30:00.000Z',
      device: 'InBody 270',
      bodyFatPct: 18.2,
      segmental: { armL: { leanKg: 3.1 } },
    });
    expect(b.data).toEqual({ bodyFatPct: 18.2, segmental: { armL: { leanKg: 3.1 } } });
    expect(fingerprint(biaToWire(biaFromRow(viaServer(b))))).toBe(fingerprint(b));
  });

  it('food, keeping the app-only details', () => {
    const entry: LogEntry = {
      id: 'f1',
      meal: 'lunch',
      name: 'Pasta',
      brand: 'Barilla',
      foodCode: '8076800195057',
      quantity: 1.5,
      unit: 'serving',
      amount: 120,
      macros: { kcal: 427.33, protein: 14.4, carbs: 86.1, fat: 2.4 },
      loggedAt: '2026-10-20T12:10:00.000Z',
    };
    const f = foodToWire(entry, '2026-10-20');
    expect(f.kcal).toBe(427.3);
    const back = foodFromRow(viaServer(f));
    expect(back.entry).toMatchObject({
      brand: 'Barilla',
      foodCode: '8076800195057',
      quantity: 1.5,
      unit: 'serving',
    });
    expect(fingerprint(foodToWire(back.entry, back.day))).toBe(fingerprint(f));
  });

  it('food made on the website (no extra) becomes grams in the app and stays stable', () => {
    const row = {
      client_id: 'web-1',
      day: '2026-10-21',
      meal: 'dinner',
      name: 'Salmon',
      grams: 180,
      kcal: 367,
      protein: 39.6,
      carbs: 0,
      fat: 22,
      extra: {},
      created_at: '2026-10-21T19:00:00+00:00',
    };
    const { day, entry } = foodFromRow(row);
    expect(entry).toMatchObject({ quantity: 180, unit: 'g', amount: 180 });
    const wire = foodToWire(entry, day);
    const again = foodFromRow(viaServer(wire));
    expect(fingerprint(foodToWire(again.entry, again.day))).toBe(fingerprint(wire));
  });

  it('workouts, with the weekdays and the minutes the website shows', () => {
    const w = workoutToWire(
      {
        id: 'wk1',
        name: 'Push',
        duration: 42,
        exercises: [
          {
            id: 'e1',
            name: 'Bench',
            sets: 3,
            reps: '8-12',
            restTime: 90,
            executionTime: 45,
            type: 'exercise',
          },
        ],
      },
      [4, 1, 4],
    );
    expect(w.weekdays).toEqual([1, 4]);
    expect(w.data.estimatedMinutes).toBe(42);
    const back = workoutFromRow(viaServer(w));
    expect(fingerprint(workoutToWire(back.workout, back.weekdays))).toBe(fingerprint(w));
  });
});

describe('profile', () => {
  const local: LocalProfile = {
    name: 'Giulia',
    gender: 'female',
    heightCm: 168,
    age: 30,
    activityLevel: 'moderate',
    goal: 'lose',
    targets: { kcal: 1900, protein: 120, carbs: 200, fat: 60 },
    units: { weight: 'kg', height: 'cm' },
  };

  it('age travels as a birth year', () => {
    const wire = profileToWire(local, 2026);
    expect(wire.birth_year).toBe(1996);
    const back = profileFromWire(profileWireFromRow(wire as never), local, 2026);
    expect(back).toEqual(local);
  });

  it('first sync keeps the app values, fills gaps from the account, takes the account name', () => {
    const remote = profileWireFromRow({ full_name: 'Giulia Bianchi', height_cm: 170, target_kcal: null });
    const merged = mergeProfiles(profileToWire({ ...local, heightCm: null }, 2026), remote);
    expect(merged).toMatchObject({
      full_name: 'Giulia Bianchi',
      height_cm: 170,
      target_kcal: 1900,
      gender: 'female',
    });
  });

  it('values the server would reject are left out', () => {
    const wire = profileToWire({ ...local, heightCm: 20, targets: { ...local.targets, kcal: 200 } }, 2026);
    expect(wire.height_cm).toBeNull();
    expect(wire.target_kcal).toBeNull();
  });
});
