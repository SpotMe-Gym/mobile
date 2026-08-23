import { useMemo } from 'react';
import { useWorkoutStore, Workout } from '../store/workoutStore';
import { useHasHydrated } from './useHasHydrated';

// Indexed by Date.getDay(), so Sunday must stay at position 0.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function getTodayName(): string {
  return DAYS[new Date().getDay()];
}

interface TodaysWorkouts {
  workouts: Workout[];
  /** Day name used to index the schedule, e.g. "Sunday". */
  day: string;
  /** False while the store still holds seed data; gate any UI that reads `workouts`. */
  isHydrated: boolean;
}

/**
 * Resolves the schedule entry for today into full workout objects.
 *
 * Single source of truth for the home grid card, the expandable-card preview and the
 * detail screen. These previously each kept their own copy of this derivation, which
 * let the closed and open states of the card disagree.
 */
export function useTodaysWorkouts(): TodaysWorkouts {
  const schedule = useWorkoutStore(s => s.schedule);
  const allWorkouts = useWorkoutStore(s => s.workouts);
  const isHydrated = useHasHydrated(useWorkoutStore);

  const day = getTodayName();

  const workouts = useMemo(
    () =>
      (schedule[day] ?? [])
        .map(id => allWorkouts.find(w => w.id === id))
        .filter((w): w is Workout => !!w),
    [schedule, allWorkouts, day]
  );

  return { workouts, day, isHydrated };
}
