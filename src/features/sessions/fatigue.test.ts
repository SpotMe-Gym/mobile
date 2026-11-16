import { EXERCISES } from '@/features/exercises/library';
import {
  FULL_DOSE,
  fatigueForAi,
  levelOf,
  muscleFatigue,
  muscleVolume,
  musclesOf,
  setDose,
  volumeOf,
} from '@/features/sessions/fatigue';
import type { LoggedSet, WorkoutSession } from '@/features/sessions/sessionStore';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-16T18:00:00Z');
const bench = EXERCISES.find((e) => e.primary.includes('chest') && e.secondary.includes('triceps'))!;
const squat = EXERCISES.find((e) => e.primary.includes('quadriceps'))!;

function session(
  exerciseId: string,
  sets: number,
  hoursAgo: number,
  patch: Partial<LoggedSet> = {},
): WorkoutSession {
  const at = new Date(NOW - hoursAgo * HOUR).toISOString();
  return {
    id: `${exerciseId}-${hoursAgo}`,
    workoutId: null,
    name: 'Test',
    startedAt: at,
    endedAt: at,
    plan: [],
    sets: Array.from({ length: sets }, (_, i) => ({
      id: `${i}`,
      blockId: 'b',
      exerciseId,
      exerciseName: 'x',
      setIndex: i,
      reps: 10,
      weightKg: 50,
      completedAt: at,
      ...patch,
    })),
  };
}
const of = (list: ReturnType<typeof muscleFatigue>, muscle: string) => list.find((m) => m.muscle === muscle)!;

describe('volume', () => {
  it('adds up sets, reps and kilograms', () => {
    expect(
      volumeOf([
        { reps: 10, weightKg: 50 },
        { reps: 8, weightKg: 60 },
        { reps: null, weightKg: null },
      ]),
    ).toEqual({
      sets: 3,
      reps: 18,
      kg: 980,
      topKg: 60,
    });
  });

  it('counts main muscles fully and helpers half, within the window', () => {
    const v = muscleVolume([session(bench.id, 4, 24), session(bench.id, 4, 24 * 9)], 7, NOW);
    expect(v.get('chest')).toEqual({ sets: 4, kg: 2000 });
    expect(v.get('triceps')).toEqual({ sets: 2, kg: 1000 });
  });
});

describe('fatigue', () => {
  it('scales a set by effort', () => {
    expect(setDose({ rpe: 10, reps: 5 })).toBeGreaterThan(setDose({ rpe: 8, reps: 5 }));
    expect(setDose({ rpe: 5, reps: 5 })).toBeLessThan(0.5);
    expect(setDose({ reps: 10 })).toBe(0.85);
  });

  it('knows the muscles of a library exercise', () => {
    expect(musclesOf(bench.id).primary).toContain('chest');
    expect(musclesOf(undefined)).toEqual({ primary: [], secondary: [] });
  });

  it('is high right after a hard session and fades with time', () => {
    const hard = FULL_DOSE + 2;
    const fresh = muscleFatigue([session(bench.id, hard, 0.5)], NOW);
    expect(of(fresh, 'chest').level).toBe('high');
    expect(of(fresh, 'triceps').fatigue).toBeLessThan(of(fresh, 'chest').fatigue);
    expect(of(fresh, 'quadriceps').fatigue).toBe(0);
    expect(of(fresh, 'chest').hoursToFresh).toBeGreaterThan(24);

    const dayLater = muscleFatigue([session(bench.id, hard, 24)], NOW);
    const threeDays = muscleFatigue([session(bench.id, hard, 72)], NOW);
    expect(of(dayLater, 'chest').fatigue).toBeLessThan(of(fresh, 'chest').fatigue);
    expect(of(threeDays, 'chest').level).toBe('fresh');
    expect(of(threeDays, 'chest').hoursToFresh).toBe(0);
  });

  it('recovers big muscles more slowly than small ones, and stacks sessions', () => {
    const legs = muscleFatigue([session(squat.id, 8, 30)], NOW);
    const calves = EXERCISES.find((e) => e.primary[0] === 'calves')!;
    const small = muscleFatigue([session(calves.id, 8, 30)], NOW);
    expect(of(legs, 'quadriceps').fatigue).toBeGreaterThan(of(small, 'calves').fatigue);

    const once = muscleFatigue([session(squat.id, 5, 20)], NOW);
    const twice = muscleFatigue([session(squat.id, 5, 20), session(squat.id, 5, 44)], NOW);
    expect(of(twice, 'quadriceps').fatigue).toBeGreaterThan(of(once, 'quadriceps').fatigue);
  });

  it('names the levels and lists the most fatigued first', () => {
    expect([0, 0.3, 0.5, 0.9].map(levelOf)).toEqual(['fresh', 'light', 'moderate', 'high']);
    const list = muscleFatigue([session(squat.id, 10, 1)], NOW);
    expect(list[0]!.fatigue).toBeGreaterThanOrEqual(list[1]!.fatigue);
  });

  it('gives the AI the trained muscles only', () => {
    const data = fatigueForAi([session(bench.id, 6, 10)], NOW);
    expect(data.find((m) => m.muscle === 'chest')).toMatchObject({
      weekSets: 6,
      weekKg: 3000,
      hoursSinceTrained: 10,
    });
    expect(data.find((m) => m.muscle === 'calves')).toBeUndefined();
  });
});
