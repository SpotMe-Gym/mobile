/**
 * Conversions between the app's records and the website's rows ("wire" = exactly the columns
 * the app sends, normalised). Invariant, tested: toWire(fromRow(toWire(x))) equals toWire(x),
 * so a record that round-trips through the server keeps the same fingerprint.
 */
import { isDayKey, ISO_WEEKDAYS, type DayKey, type IsoWeekday } from '@/shared/utils/date';
import type { WeightEntry } from '@/features/body-weight/weightStore';
import { cleanValues } from '@/features/body/bodyStore';
import type { BiaReport, MeasurementEntry, MeasurementValues } from '@/features/body/types';
import { isMealType, type LogEntry, type PortionUnit } from '@/features/nutrition/nutritionStore';
import {
  calculateDuration,
  normaliseExercise,
  type Exercise,
  type Workout,
} from '@/features/workouts/workoutStore';
import type {
  ActivityLevel,
  Gender,
  Goal,
  HeightUnit,
  UserProfile,
  WeightUnit,
} from '@/features/profile/userStore';

export type SyncTable =
  'weight_entries' | 'measurement_entries' | 'bia_reports' | 'food_entries' | 'workouts';
export const SYNC_TABLES: readonly SyncTable[] = [
  'weight_entries',
  'measurement_entries',
  'bia_reports',
  'food_entries',
  'workouts',
];

type Row = Record<string, unknown>;
const isRecord = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const nonNeg1 = (v: unknown) => round(Math.max(0, num(v) ?? 0), 1);
const iso = (v: unknown): string => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString();
};
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export interface WeightWire {
  client_id: string;
  day: DayKey;
  kg: number;
  created_at: string;
}
export const weightToWire = (e: WeightEntry): WeightWire => ({
  client_id: e.id,
  day: e.day,
  kg: round(e.kg, 2),
  created_at: iso(e.createdAt),
});
export const weightFromRow = (r: Row): WeightEntry => ({
  id: String(r.client_id),
  day: String(r.day),
  kg: num(r.kg) ?? 0,
  createdAt: iso(r.created_at),
});
export const weightValid = (w: WeightWire) => isDayKey(w.day) && w.kg >= 20 && w.kg <= 400;

// ---------------------------------------------------------------------------
// Tape measurements
// ---------------------------------------------------------------------------

export interface MeasurementWire {
  client_id: string;
  day: DayKey;
  values: MeasurementValues;
  created_at: string;
}
export const measurementToWire = (m: MeasurementEntry): MeasurementWire => ({
  client_id: m.id,
  day: m.day,
  values: cleanValues(m.values),
  created_at: iso(m.createdAt),
});
export const measurementFromRow = (r: Row): MeasurementEntry => ({
  id: String(r.client_id),
  source: 'manual',
  day: String(r.day),
  createdAt: iso(r.created_at),
  values: cleanValues(isRecord(r.values) ? (r.values as MeasurementValues) : {}),
});
export const measurementValid = (m: MeasurementWire) => isDayKey(m.day);

// ---------------------------------------------------------------------------
// BIA reports
// ---------------------------------------------------------------------------

export interface BiaWire {
  client_id: string;
  day: DayKey;
  device: string | null;
  data: Row;
  created_at: string;
}
export const biaToWire = (b: BiaReport): BiaWire => {
  const { id, source: _source, day, createdAt, device, ...data } = b;
  return {
    client_id: id,
    day,
    device: device ? device.slice(0, 60) : null,
    data: JSON.parse(JSON.stringify(data)) as Row,
    created_at: iso(createdAt),
  };
};
export const biaFromRow = (r: Row): BiaReport => {
  const data = isRecord(r.data) ? r.data : {};
  const { id: _i, source: _s, day: _d, createdAt: _c, device: _dev, ...fields } = data;
  return {
    ...(fields as Partial<BiaReport>),
    id: String(r.client_id),
    source: 'bia',
    day: String(r.day),
    createdAt: iso(r.created_at),
    device: str(r.device),
  };
};
export const biaValid = (b: BiaWire) => isDayKey(b.day);

// ---------------------------------------------------------------------------
// Food log
// ---------------------------------------------------------------------------

const PORTION_UNITS: readonly (PortionUnit | 'portion')[] = ['g', 'ml', 'oz', 'serving', 'portion'];

export interface FoodWire {
  client_id: string;
  day: DayKey;
  meal: LogEntry['meal'];
  name: string;
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  extra: { brand?: string; foodCode?: string; quantity: number; unit: LogEntry['unit'] };
  created_at: string;
}
export const foodToWire = (e: LogEntry, day: DayKey): FoodWire => ({
  client_id: e.id,
  day,
  meal: e.meal,
  name: (e.name.trim() || '—').slice(0, 200),
  grams: typeof e.amount === 'number' && Number.isFinite(e.amount) ? nonNeg1(e.amount) : null,
  kcal: nonNeg1(e.macros.kcal),
  protein: nonNeg1(e.macros.protein),
  carbs: nonNeg1(e.macros.carbs),
  fat: nonNeg1(e.macros.fat),
  extra: {
    brand: e.brand || undefined,
    foodCode: e.foodCode || undefined,
    quantity: round(num(e.quantity) ?? 1, 2),
    unit: e.unit,
  },
  created_at: iso(e.loggedAt),
});
export const foodFromRow = (r: Row): { day: DayKey; entry: LogEntry } => {
  const extra = isRecord(r.extra) ? r.extra : {};
  const grams = num(r.grams);
  const unit = PORTION_UNITS.includes(extra.unit as PortionUnit)
    ? (extra.unit as LogEntry['unit'])
    : grams !== null
      ? 'g'
      : 'portion';
  return {
    day: String(r.day),
    entry: {
      id: String(r.client_id),
      meal: isMealType(r.meal) ? r.meal : 'snack',
      name: typeof r.name === 'string' && r.name ? r.name : '—',
      brand: str(extra.brand),
      foodCode: str(extra.foodCode),
      quantity: num(extra.quantity) ?? grams ?? 1,
      unit,
      amount: grams ?? undefined,
      macros: {
        kcal: nonNeg1(r.kcal),
        protein: nonNeg1(r.protein),
        carbs: nonNeg1(r.carbs),
        fat: nonNeg1(r.fat),
      },
      loggedAt: iso(r.created_at),
    },
  };
};
export const foodValid = (f: FoodWire) => isDayKey(f.day) && isMealType(f.meal) && f.name.length > 0;

// ---------------------------------------------------------------------------
// Workouts (+ the weekdays they're scheduled on)
// ---------------------------------------------------------------------------

export interface WorkoutWire {
  client_id: string;
  name: string;
  data: { exercises: Exercise[]; estimatedMinutes: number; lastPerformed?: string };
  weekdays: IsoWeekday[];
}
const cleanExercises = (raw: unknown): Exercise[] =>
  (Array.isArray(raw) ? raw : [])
    .map(normaliseExercise)
    .filter((e): e is Exercise => e !== null)
    .map((e) => JSON.parse(JSON.stringify(e)) as Exercise);
const cleanWeekdays = (raw: unknown): IsoWeekday[] =>
  [...new Set((Array.isArray(raw) ? raw : []).map(Number))]
    .filter((d): d is IsoWeekday => (ISO_WEEKDAYS as readonly number[]).includes(d))
    .sort();

export const workoutToWire = (w: Workout, weekdays: readonly IsoWeekday[]): WorkoutWire => {
  const exercises = cleanExercises(w.exercises);
  return {
    client_id: w.id,
    name: (w.name.trim() || 'Workout').slice(0, 120),
    data: {
      exercises,
      estimatedMinutes:
        Number.isFinite(w.duration) && w.duration > 0 ? Math.round(w.duration) : calculateDuration(exercises),
      lastPerformed: w.lastPerformed || undefined,
    },
    weekdays: cleanWeekdays(weekdays),
  };
};
export const workoutFromRow = (r: Row): { workout: Workout; weekdays: IsoWeekday[] } => {
  const data = isRecord(r.data) ? r.data : {};
  const exercises = cleanExercises(data.exercises);
  const minutes = num(data.estimatedMinutes);
  return {
    workout: {
      id: String(r.client_id),
      name: typeof r.name === 'string' && r.name ? r.name : 'Workout',
      exercises,
      duration: minutes !== null && minutes > 0 ? Math.round(minutes) : calculateDuration(exercises),
      lastPerformed: str(data.lastPerformed),
    },
    weekdays: cleanWeekdays(r.weekdays),
  };
};
export const workoutValid = (w: WorkoutWire) => w.name.length > 0;

// ---------------------------------------------------------------------------
// Profile (one row per account)
// ---------------------------------------------------------------------------

export interface ProfileWire {
  full_name: string;
  gender: Gender | null;
  birth_year: number | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  target_kcal: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  weight_unit: WeightUnit;
  height_unit: HeightUnit;
}
export type LocalProfile = UserProfile & { units: { weight: WeightUnit; height: HeightUnit } };

const inRange = (v: unknown, min: number, max: number, digits = 0): number | null => {
  const n = num(v);
  return n !== null && n >= min && n <= max ? round(n, digits) : null;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | null =>
  options.includes(v as T) ? (v as T) : null;

const GENDERS = ['male', 'female', 'neutral'] as const;
const ACTIVITIES = ['sedentary', 'light', 'moderate', 'very', 'super'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;

export function profileToWire(p: LocalProfile, year = new Date().getFullYear()): ProfileWire {
  return {
    full_name: p.name.trim().slice(0, 100),
    gender: oneOf(p.gender, GENDERS),
    birth_year: p.age !== null && p.age > 0 ? inRange(year - Math.round(p.age), 1900, 2100) : null,
    height_cm: inRange(p.heightCm, 80, 260, 1),
    activity_level: oneOf(p.activityLevel, ACTIVITIES),
    goal: oneOf(p.goal, GOALS),
    target_kcal: inRange(p.targets.kcal, 800, 8000),
    target_protein: inRange(p.targets.protein, 0, 600),
    target_carbs: inRange(p.targets.carbs, 0, 1200),
    target_fat: inRange(p.targets.fat, 0, 400),
    weight_unit: p.units.weight === 'lbs' ? 'lbs' : 'kg',
    height_unit: p.units.height === 'ft' ? 'ft' : 'cm',
  };
}

export function profileWireFromRow(r: Row): ProfileWire {
  return {
    full_name: typeof r.full_name === 'string' ? r.full_name.trim().slice(0, 100) : '',
    gender: oneOf(r.gender, GENDERS),
    birth_year: inRange(r.birth_year, 1900, 2100),
    height_cm: inRange(r.height_cm, 80, 260, 1),
    activity_level: oneOf(r.activity_level, ACTIVITIES),
    goal: oneOf(r.goal, GOALS),
    target_kcal: inRange(r.target_kcal, 800, 8000),
    target_protein: inRange(r.target_protein, 0, 600),
    target_carbs: inRange(r.target_carbs, 0, 1200),
    target_fat: inRange(r.target_fat, 0, 400),
    weight_unit: r.weight_unit === 'lbs' ? 'lbs' : 'kg',
    height_unit: r.height_unit === 'ft' ? 'ft' : 'cm',
  };
}

/** What the app shows for a profile row. Missing targets keep the app's current ones. */
export function profileFromWire(
  w: ProfileWire,
  current: LocalProfile,
  year = new Date().getFullYear(),
): LocalProfile {
  return {
    name: w.full_name,
    gender: w.gender,
    age: w.birth_year !== null ? year - w.birth_year : null,
    heightCm: w.height_cm,
    activityLevel: w.activity_level,
    goal: w.goal,
    targets: {
      kcal: w.target_kcal ?? current.targets.kcal,
      protein: w.target_protein ?? current.targets.protein,
      carbs: w.target_carbs ?? current.targets.carbs,
      fat: w.target_fat ?? current.targets.fat,
    },
    units: { weight: w.weight_unit, height: w.height_unit },
  };
}

/**
 * First sync of a profile: keep what the app has and fill the gaps from the account. The name
 * is the exception: the account's (often the full name from Apple / Google) wins when set.
 */
export function mergeProfiles(local: ProfileWire, remote: ProfileWire): ProfileWire {
  const pick = <K extends keyof ProfileWire>(k: K): ProfileWire[K] =>
    (local[k] ?? remote[k]) as ProfileWire[K];
  return {
    full_name: remote.full_name || local.full_name,
    gender: pick('gender'),
    birth_year: pick('birth_year'),
    height_cm: pick('height_cm'),
    activity_level: pick('activity_level'),
    goal: pick('goal'),
    target_kcal: pick('target_kcal'),
    target_protein: pick('target_protein'),
    target_carbs: pick('target_carbs'),
    target_fat: pick('target_fat'),
    weight_unit: local.weight_unit,
    height_unit: local.height_unit,
  };
}
