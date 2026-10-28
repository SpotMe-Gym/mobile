import { isoWeekday, toDayKey, type IsoWeekday } from '@/shared/utils/date';
import type { WeekSchedule } from '@/features/workouts/workoutStore';
import { estimatedOneRepMax, type WorkoutSession } from '@/features/sessions/sessionStore';
import { exerciseKey } from '@/features/exercises/resolve';

export interface DayStatus {
  weekday: IsoWeekday;
  planned: number;
  done: number;
  isToday: boolean;
}

/** Monday-to-Sunday of the current week: workouts planned and sessions finished each day. */
export function weekStatus(
  schedule: WeekSchedule,
  sessions: readonly WorkoutSession[],
  now = new Date(),
): DayStatus[] {
  const today = isoWeekday(now);
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (today - 1));
  return ([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).map((d) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + d - 1);
    const key = toDayKey(day);
    return {
      weekday: d,
      planned: schedule[d]?.length ?? 0,
      done: sessions.filter((s) => s.endedAt !== null && toDayKey(new Date(s.startedAt)) === key).length,
      isToday: d === today,
    };
  });
}

export interface RecordEntry {
  name: string;
  oneRepMaxKg: number;
  at: string;
}

/** For each exercise, the set that set its best estimated 1RM; most recent records first. */
export function personalRecords(sessions: readonly WorkoutSession[], limit = 3): RecordEntry[] {
  const best = new Map<string, RecordEntry>();
  for (const s of sessions) {
    if (s.endedAt === null) continue;
    for (const st of s.sets) {
      const e = estimatedOneRepMax(st.weightKg, st.reps);
      if (e === null) continue;
      const k = exerciseKey(st.exerciseId, st.exerciseName);
      if (e > (best.get(k)?.oneRepMaxKg ?? 0))
        best.set(k, { name: st.exerciseName, oneRepMaxKg: Math.round(e * 10) / 10, at: st.completedAt });
    }
  }
  return [...best.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
