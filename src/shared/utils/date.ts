/**
 * Calendar-day helpers. A log's "day" is always the user's LOCAL civil day:
 * never derive it from toISOString() (UTC), and never parse a YYYY-MM-DD key with
 * new Date(key) (also UTC). Both shift entries to the wrong day around midnight.
 */

export type DayKey = string; // YYYY-MM-DD, local time

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date = new Date()): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const ISO_WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7] as const;

export function isoWeekday(date: Date = new Date()): IsoWeekday {
  const js = date.getDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** Localised weekday label for an ISO weekday (uses a fixed reference week). */
export function weekdayLabel(
  day: IsoWeekday,
  locale: string,
  style: 'long' | 'short' | 'narrow' = 'short',
): string {
  // 2024-01-01 was a Monday.
  const ref = new Date(2024, 0, day);
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(ref);
}

export function formatDayKey(
  key: DayKey,
  locale: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return fromDayKey(key).toLocaleDateString(locale, options);
}

/**
 * Whole local calendar days from `iso` to `now` (0 = today, 1 = yesterday). Uses calendar
 * days, not 24 h periods, so 23:59 yesterday is still "yesterday" at 00:01.
 */
export function calendarDaysAgo(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(then)) / 86_400_000);
}

/** Milliseconds until the next local midnight. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
