import { EXERCISES } from '@/features/exercises/library';
import { clock, exerciseSummary, workoutTotals } from '@/features/workouts/summary';

const chest = EXERCISES.find((e) => e.primary[0] === 'chest')!;
const legs = EXERCISES.find((e) => e.primary[0] === 'quadriceps')!;
const base = { type: 'exercise' as const, reps: '10', restTime: 60, executionTime: 0 };

describe('workout summary', () => {
  it('formats seconds as a clock', () => {
    expect([0, 45, 75, 600].map(clock)).toEqual(['0:00', '0:45', '1:15', '10:00']);
  });

  it('adds up exercises, sets and time, and lists muscles by sets', () => {
    const totals = workoutTotals([
      { ...base, name: 'Press', sets: 2, exerciseId: chest.id },
      { ...base, name: 'Squat', sets: 5, exerciseId: legs.id },
      { ...base, type: 'rest', name: '', sets: 0, restTime: 120 },
      { ...base, name: '', sets: 3 }, // not chosen yet: doesn't count
    ]);
    expect(totals.exercises).toBe(2);
    expect(totals.sets).toBe(7);
    expect(totals.muscles.slice(0, 2)).toEqual(['quadriceps', 'chest']);
    expect(totals.minutes).toBeGreaterThan(8);
    expect(workoutTotals([])).toMatchObject({ exercises: 0, sets: 0, minutes: 0, muscles: [] });
  });

  it('summarises an exercise in parts', () => {
    expect(
      exerciseSummary({ ...base, name: 'x', sets: 3, weight: 60, executionTime: 45, executionTime2: 30 }),
    ).toEqual({
      setsReps: '3 × 10',
      weightKg: 60,
      rest: '1:00',
      timed: '0:45 + 0:30',
    });
    expect(exerciseSummary({ ...base, name: 'x', sets: 4, reps: '', restTime: 0 })).toEqual({
      setsReps: '4 ×',
      weightKg: undefined,
      rest: undefined,
      timed: undefined,
    });
  });
});
