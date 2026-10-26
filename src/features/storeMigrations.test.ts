import { migrateUserState } from '@/features/profile/userStore';
import { migrateNutritionState } from '@/features/nutrition/nutritionStore';
import { migrateWorkoutState } from '@/features/workouts/workoutStore';
import { convertLegacyWeights } from '@/features/body-weight/weightStore';
import { LEGACY_WEIGHT_KEY, userMMKV } from '@/shared/lib/storage';

describe('userStore v0 → v1', () => {
  const v0 = {
    name: 'Demis',
    gender: 'Male',
    height: '180',
    weight: '80.5',
    age: '30',
    hasCompletedOnboarding: true,
    weightHistory: [{ id: 'a', date: '2026-01-01', weight: 81 }],
    units: { weight: 'lbs', height: 'cm' },
    activityLevel: 'Moderately Active',
    goal: 'Gain Muscle',
    targets: { calories: 3000, protein: 200, carbs: 300, fat: 90 },
  };

  it('converts strings to numbers and labels to ids', () => {
    const s = migrateUserState(v0, 0);
    expect(s).toMatchObject({
      name: 'Demis',
      gender: 'male',
      heightCm: 180,
      age: 30,
      activityLevel: 'moderate',
      goal: 'gain',
      targets: { kcal: 3000, protein: 200, carbs: 300, fat: 90 },
      units: { weight: 'lbs', height: 'cm' },
      hasCompletedOnboarding: true,
      language: 'system',
    });
  });

  it('hands the weight history off to the weight store', () => {
    migrateUserState(v0, 0);
    const raw = userMMKV.getString(LEGACY_WEIGHT_KEY);
    expect(raw).toBeDefined();
    const entries = convertLegacyWeights(JSON.parse(raw ?? '{}'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ day: '2026-01-01', kg: 81 });
  });

  it('survives garbage', () => {
    expect(() => migrateUserState(null, 0)).not.toThrow();
    expect(migrateUserState('nope', 0).targets?.kcal).toBe(2800);
  });
});

describe('nutritionStore v1 → v2', () => {
  const v1 = {
    logs: {
      '2026-10-20': {
        date: '2026-10-20',
        meals: [
          { name: 'Lunch', foods: [{ id: '123', name: 'Pasta', calories: 400, protein: 12, carbs: 80, fat: 3 }, { id: '123', name: 'Pasta', calories: 400, protein: 12, carbs: 80, fat: 3 }] },
          { name: 'Breakfast', foods: [] },
        ],
      },
    },
    knownFoods: { '123': { id: '123', name: 'Pasta', calories: 400, protein: 12, carbs: 80, fat: 3, tags: ['Lunch'], lastUsed: '2026-10-20T12:00:00Z' } },
  };

  it('gives duplicate foods unique entry ids', () => {
    const s = migrateNutritionState(v1, 1);
    const entries = s.days?.['2026-10-20'] ?? [];
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).not.toBe(entries[1]?.id);
    expect(entries[0]).toMatchObject({ meal: 'lunch', foodCode: '123', unit: 'portion', macros: { kcal: 400 } });
  });

  it('drops corrupted portion-scaled history values so they get re-fetched', () => {
    const s = migrateNutritionState(v1, 1);
    expect(s.foods?.['123']).toMatchObject({ name: 'Pasta', per100: null, meals: ['lunch'] });
  });
});

describe('workoutStore v0–v4 → v5', () => {
  it('re-keys the schedule by ISO weekday and drops unknown ids', () => {
    const s = migrateWorkoutState(
      {
        workouts: [{ id: '1', name: 'Push', duration: 45, exercises: [{ id: 'e1', name: 'Bench', sets: 3, reps: '8', difficulty: 'x' }] }],
        schedule: { Monday: ['1'], Tuesday: ['ghost'], Sunday: '1' },
      },
      2,
    );
    expect(s.schedule?.[1]).toEqual(['1']);
    expect(s.schedule?.[2]).toEqual([]);
    expect(s.schedule?.[7]).toEqual(['1']); // v0 stored a single string per day
    expect(s.workouts?.[0]?.exercises[0]).toMatchObject({ restTime: 60, executionTime: 45, type: 'exercise' });
  });
});
