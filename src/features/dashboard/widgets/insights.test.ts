import {
  caloriesWeek,
  frequentFoods,
  nextWorkout,
  trainingStreak,
  weeklyVolume,
  weightWindow,
} from '@/features/dashboard/widgets/insights';
import type { WorkoutSession } from '@/features/sessions/sessionStore';
import type { FoodHistoryItem } from '@/features/nutrition/nutritionStore';
import { emptySchedule, type Workout } from '@/features/workouts/workoutStore';

// Wednesday 28 Oct 2026, 10:00 local
const NOW = new Date(2026, 9, 28, 10);
const session = (
  id: string,
  day: number,
  sets: [string, string][],
  workoutId: string | null = null,
): WorkoutSession => ({
  id,
  workoutId,
  name: 'W',
  startedAt: new Date(2026, 9, day, 18).toISOString(),
  endedAt: new Date(2026, 9, day, 19).toISOString(),
  plan: [],
  sets: sets.map(([exerciseId, exerciseName], i) => ({
    id: `${id}-${i}`,
    blockId: 'b',
    exerciseId,
    exerciseName,
    setIndex: i,
    reps: 8,
    weightKg: 50,
    completedAt: new Date(2026, 9, day, 18, 30).toISOString(),
  })),
});

describe('widget insights', () => {
  it('weight window: last 30 days and the change', () => {
    const w = weightWindow(
      [
        { id: 'a', day: '2026-09-01', kg: 82, createdAt: '' },
        { id: 'b', day: '2026-10-05', kg: 81, createdAt: '' },
        { id: 'c', day: '2026-10-27', kg: 79.5, createdAt: '' },
      ],
      30,
      NOW,
    );
    expect(w.points.map((p) => p.id)).toEqual(['b', 'c']);
    expect(w.changeKg).toBeCloseTo(-1.5);
  });

  it('calories: seven days ending today', () => {
    const week = caloriesWeek(
      {
        '2026-10-28': [{ macros: { kcal: 500.4 } }, { macros: { kcal: 300 } }],
        '2026-10-22': [{ macros: { kcal: 2000 } }],
      } as never,
      NOW,
    );
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: '2026-10-22', kcal: 2000 });
    expect(week[6]).toEqual({ day: '2026-10-28', kcal: 800 });
  });

  it('frequent foods: most used first, only loggable ones', () => {
    const f = (code: string, useCount: number, per100: unknown = { kcal: 1 }) =>
      ({
        code,
        name: code,
        useCount,
        per100,
        lastUsed: '2026-10-01',
        base: 'g',
        source: 'off',
        meals: [],
      }) as unknown as FoodHistoryItem;
    expect(frequentFoods({ a: f('a', 2), b: f('b', 9), c: f('c', 5, null) }).map((x) => x.code)).toEqual([
      'b',
      'a',
    ]);
  });

  it('next workout: skips today once done, else the next scheduled day', () => {
    const schedule = { ...emptySchedule(), 3: ['legs'], 5: ['push'] };
    const workouts = [
      { id: 'legs', name: 'Legs', exercises: [], duration: 40 },
      { id: 'push', name: 'Push', exercises: [], duration: 50 },
    ] as Workout[];
    expect(nextWorkout(schedule, workouts, [], NOW)).toMatchObject({ workout: { id: 'legs' }, inDays: 0 });
    const done = [
      { ...session('s', 28, []), workoutId: 'legs', startedAt: new Date(2026, 9, 28, 8).toISOString() },
    ];
    expect(nextWorkout(schedule, workouts, done, NOW)).toMatchObject({ workout: { id: 'push' }, inDays: 2 });
    expect(nextWorkout(emptySchedule(), workouts, [], NOW)).toBeNull();
  });

  it('weekly volume: sets per muscle group, this week vs last', () => {
    const v = weeklyVolume(
      [
        session('a', 27, [
          ['Barbell_Full_Squat', 'Squat'],
          ['Barbell_Full_Squat', 'Squat'],
          ['Barbell_Bench_Press_-_Medium_Grip', 'Bench'],
        ]),
        session('b', 20, [['Barbell_Full_Squat', 'Squat']]),
        session('c', 5, [['Barbell_Full_Squat', 'Squat']]),
      ],
      NOW,
    );
    expect(v.legs).toEqual({ now: 2, last: 1 });
    expect(v.chest).toEqual({ now: 1, last: 0 });
  });

  it('streak: weeks in a row with a session', () => {
    expect(
      trainingStreak(
        [session('a', 27, []), session('b', 21, []), session('c', 14, []), session('d', 1, [])],
        NOW,
      ),
    ).toBe(3);
    // Nothing yet this week: the streak still counts up to last week
    expect(trainingStreak([session('b', 21, []), session('c', 14, [])], NOW)).toBe(2);
    expect(trainingStreak([], NOW)).toBe(0);
  });
});
