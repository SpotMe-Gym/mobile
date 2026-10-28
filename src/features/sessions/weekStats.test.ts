import { personalRecords, weekStatus } from '@/features/sessions/weekStats';
import type { WorkoutSession } from '@/features/sessions/sessionStore';

const session = (
  id: string,
  startedAt: string,
  sets: [string, number, number][],
  ended = true,
): WorkoutSession => ({
  id,
  workoutId: null,
  name: 'W',
  startedAt,
  endedAt: ended ? startedAt : null,
  plan: [],
  sets: sets.map(([name, reps, weightKg], i) => ({
    id: `${id}-${i}`,
    blockId: 'b',
    exerciseName: name,
    setIndex: i,
    reps,
    weightKg,
    completedAt: startedAt,
  })),
});

describe('week status', () => {
  it('counts planned workouts and finished sessions per day of this week', () => {
    const wed = new Date(2026, 9, 28, 18, 0); // Wednesday
    const schedule = { 1: ['a'], 2: [], 3: ['b'], 4: ['a'], 5: [], 6: [], 7: [] };
    const days = weekStatus(
      schedule,
      [
        session('s1', new Date(2026, 9, 26, 18).toISOString(), []),
        session('s2', new Date(2026, 9, 28, 7).toISOString(), [], false),
      ],
      wed,
    );
    expect(days.map((d) => [d.planned, d.done])).toEqual([
      [1, 1],
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(days.find((d) => d.isToday)?.weekday).toBe(3);
  });
});

describe('personal records', () => {
  it('keeps the best estimated 1RM per exercise, newest first', () => {
    const records = personalRecords([
      session('a', '2026-10-20T17:00:00.000Z', [
        ['Bench', 8, 60],
        ['Squat', 5, 100],
      ]),
      session('b', '2026-10-27T17:00:00.000Z', [['Bench', 8, 65]]),
    ]);
    expect(records).toEqual([
      { name: 'Bench', oneRepMaxKg: 82.3, at: '2026-10-27T17:00:00.000Z' },
      { name: 'Squat', oneRepMaxKg: 116.7, at: '2026-10-20T17:00:00.000Z' },
    ]);
  });
});
