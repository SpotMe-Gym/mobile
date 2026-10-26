import { useMemo } from 'react';
import { useWorkoutStore, type Workout } from '@/features/workouts/workoutStore';
import { fromDayKey, isoWeekday, type IsoWeekday } from '@/shared/utils/date';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { useToday } from '@/shared/hooks/useToday';

interface TodaysWorkouts {
  workouts: Workout[];
  /** ISO weekday used to index the schedule (Mon = 1). */
  weekday: IsoWeekday;
  /** False while the store still holds its initial state; gate any UI that reads `workouts`. */
  isHydrated: boolean;
}

/**
 * Resolves today's schedule entry into workouts. Single source of truth for the home card,
 * the expandable-card preview and the detail screen, so closed and open states agree.
 */
export function useTodaysWorkouts(): TodaysWorkouts {
  const schedule = useWorkoutStore((s) => s.schedule);
  const allWorkouts = useWorkoutStore((s) => s.workouts);
  const isHydrated = useHasHydrated(useWorkoutStore);
  const today = useToday(); // re-evaluates the weekday at midnight
  const weekday = useMemo(() => isoWeekday(fromDayKey(today)), [today]);

  const workouts = useMemo(
    () =>
      (schedule[weekday] ?? [])
        .map((id) => allWorkouts.find((w) => w.id === id))
        .filter((w): w is Workout => !!w),
    [schedule, allWorkouts, weekday],
  );

  return { workouts, weekday, isHydrated };
}
