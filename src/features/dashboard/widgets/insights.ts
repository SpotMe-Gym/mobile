/**
 * Pure numbers behind the section widgets. Kept apart from the components so they can be
 * tested, and so the AI layer can reuse the same figures later.
 */
import { isoWeekday, toDayKey, type DayKey, type IsoWeekday } from '@/shared/utils/date';
import { GROUP_ORDER, groupOf, type MuscleGroup } from '@/features/exercises/library';
import { resolveExercise } from '@/features/exercises/resolve';
import type { WorkoutSession } from '@/features/sessions/sessionStore';
import type { Workout, WeekSchedule } from '@/features/workouts/workoutStore';
import type { FoodHistoryItem, LogEntry } from '@/features/nutrition/nutritionStore';
import type { WeightEntry } from '@/features/body-weight/weightStore';

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Monday 00:00 of the week `d` is in (local time). */
export const weekStart = (d: Date) => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - (isoWeekday(s) - 1));
  return s;
};

// --- Body ----------------------------------------------------------------------------------

/** Weights of the last `days` days (oldest first) and the change across them. */
export function weightWindow(entries: readonly WeightEntry[], days = 30, now = new Date()) {
  const from = toDayKey(new Date(startOfDay(now).getTime() - (days - 1) * DAY));
  const points = entries.filter((e) => e.day >= from);
  const first = points[0];
  const last = points[points.length - 1];
  return { points, changeKg: first && last && points.length > 1 ? last.kg - first.kg : null };
}

// --- Nutrition -----------------------------------------------------------------------------

/** Calories per day for the 7 days ending today (oldest first). */
export function caloriesWeek(days: Record<DayKey, LogEntry[]>, now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = toDayKey(new Date(startOfDay(now).getTime() - (6 - i) * DAY + DAY / 2));
    const kcal = (days[day] ?? []).reduce((n, e) => n + (e.macros.kcal || 0), 0);
    return { day, kcal: Math.round(kcal) };
  });
}

/** The foods logged most often (needs nutrition per 100 to be loggable in one tap). */
export function frequentFoods(foods: Record<string, FoodHistoryItem>, limit = 4): FoodHistoryItem[] {
  return Object.values(foods)
    .filter((f) => f.per100 !== null && !f.servingOnly)
    .sort((a, b) => b.useCount - a.useCount || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, limit);
}

// --- Training ------------------------------------------------------------------------------

export interface NextWorkout {
  workout: Workout;
  weekday: IsoWeekday;
  /** 0 = today, 1 = tomorrow… */
  inDays: number;
}

/** The next planned workout: today's if not done yet, otherwise the next scheduled day. */
export function nextWorkout(
  schedule: WeekSchedule,
  workouts: readonly Workout[],
  sessions: readonly WorkoutSession[],
  now = new Date(),
): NextWorkout | null {
  const today = toDayKey(now);
  const doneToday = new Set(
    sessions.filter((s) => s.endedAt && toDayKey(new Date(s.startedAt)) === today).map((s) => s.workoutId),
  );
  const todayWd = isoWeekday(now);
  for (let inDays = 0; inDays < 7; inDays++) {
    const wd = (((todayWd - 1 + inDays) % 7) + 1) as IsoWeekday;
    for (const id of schedule[wd] ?? []) {
      if (inDays === 0 && doneToday.has(id)) continue;
      const workout = workouts.find((w) => w.id === id);
      if (workout) return { workout, weekday: wd, inDays };
    }
  }
  return null;
}

/** Completed sets per muscle group, this week and last week. */
export function weeklyVolume(sessions: readonly WorkoutSession[], now = new Date()) {
  const thisWeek = weekStart(now).getTime();
  const lastWeek = thisWeek - 7 * DAY;
  const out = Object.fromEntries(GROUP_ORDER.map((g) => [g, { now: 0, last: 0 }])) as Record<
    MuscleGroup,
    { now: number; last: number }
  >;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const t = Date.parse(s.startedAt);
    const bucket = t >= thisWeek ? 'now' : t >= lastWeek ? 'last' : null;
    if (!bucket) continue;
    for (const set of s.sets) {
      const muscle = resolveExercise(set.exerciseId, set.exerciseName).muscles[0];
      const g = muscle ? groupOf(muscle) : null;
      if (g) out[g][bucket] += 1;
    }
  }
  return out;
}

/** Weeks in a row with at least one finished session (this week counts once it has one). */
export function trainingStreak(sessions: readonly WorkoutSession[], now = new Date()): number {
  const weeks = new Set(
    sessions.filter((s) => s.endedAt).map((s) => toDayKey(weekStart(new Date(s.startedAt)))),
  );
  let cursor = weekStart(now);
  if (!weeks.has(toDayKey(cursor))) cursor = new Date(cursor.getTime() - 7 * DAY + DAY / 2);
  let streak = 0;
  while (weeks.has(toDayKey(weekStart(cursor)))) {
    streak += 1;
    cursor = new Date(weekStart(cursor).getTime() - 7 * DAY + DAY / 2);
  }
  return streak;
}
