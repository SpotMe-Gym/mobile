import { getLibraryExercise, type Muscle } from '@/features/exercises/library';
import { calculateDuration, type Exercise } from '@/features/workouts/workoutStore';

type Item = Pick<
  Exercise,
  | 'type'
  | 'name'
  | 'sets'
  | 'reps'
  | 'weight'
  | 'restTime'
  | 'executionTime'
  | 'executionTime2'
  | 'exerciseId'
>;

/** 75 → "1:15". */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A workout at a glance: how much there is to do, how long it takes, what it trains. */
export function workoutTotals(items: readonly Item[]) {
  const exercises = items.filter((e) => e.type !== 'rest' && e.name.trim().length > 0);
  const sets = exercises.reduce((sum, e) => sum + Math.max(1, e.sets || 0), 0);
  // Muscles by how many sets train them, most first.
  const perMuscle = new Map<Muscle, number>();
  for (const e of exercises) {
    for (const m of getLibraryExercise(e.exerciseId)?.primary ?? []) {
      perMuscle.set(m, (perMuscle.get(m) ?? 0) + Math.max(1, e.sets || 0));
    }
  }
  return {
    exercises: exercises.length,
    sets,
    minutes: items.length === 0 ? 0 : calculateDuration(items as readonly Exercise[]),
    muscles: [...perMuscle.entries()].sort((a, b) => b[1] - a[1]).map(([muscle]) => muscle),
  };
}

/**
 * The parts of an exercise's one-line summary, in order: "3 × 10", the weight, the rest, the
 * timed phases. The caller formats the weight (units) and joins them.
 */
export function exerciseSummary(e: Item): {
  setsReps: string;
  weightKg?: number;
  rest?: string;
  timed?: string;
} {
  const timed = [e.executionTime, e.executionTime2 ?? 0].filter((s) => s > 0).map(clock);
  return {
    setsReps: e.reps.trim()
      ? `${Math.max(1, e.sets || 0)} × ${e.reps.trim()}`
      : `${Math.max(1, e.sets || 0)} ×`,
    weightKg: e.weight && e.weight > 0 ? e.weight : undefined,
    rest: e.restTime > 0 ? clock(e.restTime) : undefined,
    timed: timed.length ? timed.join(' + ') : undefined,
  };
}
