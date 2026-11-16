/**
 * Training volume and muscle fatigue, from the logged sets.
 *
 * Volume is what was actually lifted: sets, reps and kilograms (reps × weight).
 *
 * Fatigue is an estimate of how much of a muscle's recent work it hasn't recovered from yet.
 * Each set adds a dose to the muscles it trains (full for the main muscles, half for the
 * helpers), scaled by how hard the set was; the dose then fades with time, faster for small
 * muscles than for big ones. It's a training-load model, not a measurement of the body: it
 * doesn't know about sleep, food or soreness. It's meant to answer "what's fresh today?" and
 * to give the AI coach something to plan rest and food around.
 */
import { getLibraryExercise, type Muscle } from '@/features/exercises/library';
import { useCustomExerciseStore } from '@/features/exercises/customExerciseStore';
import type { LoggedSet, WorkoutSession } from '@/features/sessions/sessionStore';

export const MUSCLES: readonly Muscle[] = [
  'chest',
  'shoulders',
  'traps',
  'lats',
  'middle back',
  'lower back',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
  'neck',
];

const HOUR = 3_600_000;

/** Big muscles take longer to come back than small ones (hours for the dose to halve). */
const HALF_LIFE_H: Record<Muscle, number> = {
  quadriceps: 26,
  hamstrings: 26,
  glutes: 26,
  'lower back': 26,
  chest: 22,
  lats: 22,
  'middle back': 22,
  shoulders: 18,
  traps: 18,
  triceps: 16,
  biceps: 16,
  adductors: 18,
  abductors: 16,
  forearms: 12,
  calves: 12,
  abdominals: 12,
  neck: 12,
};

/** Hard sets on one muscle that count as fully fatigued right after training. */
export const FULL_DOSE = 10;
const SECONDARY = 0.5;
/** Older than this, a session no longer matters (under 2% of its dose is left). */
const WINDOW_H = 24 * 7;

export type FatigueLevel = 'fresh' | 'light' | 'moderate' | 'high';
/** Lower bounds of light, moderate and high (0–1). */
export const LEVELS = { light: 0.2, moderate: 0.45, high: 0.7 } as const;

export const levelOf = (fatigue: number): FatigueLevel =>
  fatigue >= LEVELS.high
    ? 'high'
    : fatigue >= LEVELS.moderate
      ? 'moderate'
      : fatigue >= LEVELS.light
        ? 'light'
        : 'fresh';

/** The muscles a set trains: [main, helpers]. */
export function musclesOf(exerciseId: string | undefined): { primary: Muscle[]; secondary: Muscle[] } {
  const lib = getLibraryExercise(exerciseId);
  if (lib) return { primary: lib.primary, secondary: lib.secondary };
  if (exerciseId) {
    const custom = useCustomExerciseStore.getState().exercises.find((e) => e.id === exerciseId);
    if (custom) {
      const known = custom.muscles.filter((m): m is Muscle => (MUSCLES as readonly string[]).includes(m));
      return { primary: known, secondary: [] };
    }
  }
  return { primary: [], secondary: [] };
}

/**
 * How much one set counts, around 1 for a normal hard set. Effort (RPE 1–10) scales it: an
 * easy set (RPE 5) counts about half, an all-out one a little more than one. Without an RPE a
 * set counts 0.85. Very long sets (20+ reps) and very short heavy ones are left alone: the
 * model counts hard sets, like the research on training volume does.
 */
export function setDose(set: Pick<LoggedSet, 'rpe' | 'reps' | 'durationSec'>): number {
  if (set.rpe !== undefined && set.rpe !== null) return Math.max(0.3, Math.min(1.2, (set.rpe - 2) / 6.5));
  if ((set.reps ?? 0) <= 0 && (set.durationSec ?? 0) <= 0) return 0.5;
  return 0.85;
}

/** Kilograms moved in a set (reps × weight); 0 for bodyweight or timed sets. */
export const setVolumeKg = (set: Pick<LoggedSet, 'reps' | 'weightKg'>) =>
  Math.max(0, set.reps ?? 0) * Math.max(0, set.weightKg ?? 0);

export interface MuscleFatigue {
  muscle: Muscle;
  /** 0–1: share of a full session's dose still unrecovered. */
  fatigue: number;
  level: FatigueLevel;
  /** Hours until it's back to fresh (0 when it already is). */
  hoursToFresh: number;
  /** When it was last trained (ms), if within the last week. */
  lastTrainedAt: number | null;
}

/** Fatigue of every muscle right now, most fatigued first. */
export function muscleFatigue(sessions: readonly WorkoutSession[], now = Date.now()): MuscleFatigue[] {
  const dose = new Map<Muscle, number>();
  const last = new Map<Muscle, number>();
  const add = (muscle: Muscle, amount: number, at: number) => {
    const hours = Math.max(0, (now - at) / HOUR);
    dose.set(muscle, (dose.get(muscle) ?? 0) + amount * 0.5 ** (hours / HALF_LIFE_H[muscle]));
    if (at > (last.get(muscle) ?? 0)) last.set(muscle, at);
  };
  for (const session of sessions) {
    const started = Date.parse(session.startedAt);
    if (!Number.isFinite(started) || now - started > WINDOW_H * HOUR || started > now) continue;
    for (const set of session.sets) {
      const at = Date.parse(set.completedAt) || started;
      const { primary, secondary } = musclesOf(set.exerciseId);
      const d = setDose(set);
      for (const m of primary) add(m, d, at);
      for (const m of secondary) add(m, d * SECONDARY, at);
    }
  }
  return MUSCLES.map((muscle) => {
    const fatigue = Math.min(1, (dose.get(muscle) ?? 0) / FULL_DOSE);
    return {
      muscle,
      fatigue,
      level: levelOf(fatigue),
      hoursToFresh:
        fatigue > LEVELS.light ? Math.ceil(HALF_LIFE_H[muscle] * Math.log2(fatigue / LEVELS.light)) : 0,
      lastTrainedAt: last.get(muscle) ?? null,
    };
  }).sort((a, b) => b.fatigue - a.fatigue);
}

export interface ExerciseVolume {
  sets: number;
  reps: number;
  /** Kilograms moved (reps × weight over the sets). */
  kg: number;
  /** Heaviest weight used. */
  topKg: number;
}

export function volumeOf(sets: readonly Pick<LoggedSet, 'reps' | 'weightKg'>[]): ExerciseVolume {
  return {
    sets: sets.length,
    reps: sets.reduce((s, x) => s + Math.max(0, x.reps ?? 0), 0),
    kg: sets.reduce((s, x) => s + setVolumeKg(x), 0),
    topKg: sets.reduce((m, x) => Math.max(m, x.weightKg ?? 0), 0),
  };
}

/** Hard sets and kilograms per muscle over the last `days` (main muscles 1, helpers ½). */
export function muscleVolume(sessions: readonly WorkoutSession[], days = 7, now = Date.now()) {
  const out = new Map<Muscle, { sets: number; kg: number }>();
  const add = (m: Muscle, sets: number, kg: number) => {
    const cur = out.get(m) ?? { sets: 0, kg: 0 };
    out.set(m, { sets: cur.sets + sets, kg: cur.kg + kg });
  };
  for (const session of sessions) {
    const started = Date.parse(session.startedAt);
    if (!Number.isFinite(started) || now - started > days * 24 * HOUR || started > now) continue;
    for (const set of session.sets) {
      const { primary, secondary } = musclesOf(set.exerciseId);
      const kg = setVolumeKg(set);
      for (const m of primary) add(m, 1, kg);
      for (const m of secondary) add(m, SECONDARY, kg * SECONDARY);
    }
  }
  return out;
}

/**
 * Fatigue and weekly volume as compact data for the AI coach (to plan rest days, what to
 * train next, and how much to eat around hard sessions).
 */
export function fatigueForAi(sessions: readonly WorkoutSession[], now = Date.now()) {
  const volume = muscleVolume(sessions, 7, now);
  return muscleFatigue(sessions, now)
    .filter((m) => m.fatigue > 0.02 || volume.has(m.muscle))
    .map((m) => ({
      muscle: m.muscle,
      fatiguePct: Math.round(m.fatigue * 100),
      level: m.level,
      hoursToFresh: m.hoursToFresh,
      hoursSinceTrained: m.lastTrainedAt === null ? null : Math.round((now - m.lastTrainedAt) / HOUR),
      weekSets: Math.round((volume.get(m.muscle)?.sets ?? 0) * 10) / 10,
      weekKg: Math.round(volume.get(m.muscle)?.kg ?? 0),
    }));
}
