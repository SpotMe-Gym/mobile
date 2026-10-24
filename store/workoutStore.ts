import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/lib/ids';
import { ISO_WEEKDAYS, type IsoWeekday } from '@/utils/date';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // free text: "8-12", "AMRAP"
  weight?: number;
  restTime: number; // seconds
  executionTime: number; // seconds
  executionName?: string;
  executionTime2?: number; // seconds (optional second phase)
  executionName2?: string;
  notes?: string;
  type: 'exercise' | 'rest';
}

export interface Workout {
  id: string;
  name: string;
  duration: number; // minutes (calculated)
  exercises: Exercise[];
  lastPerformed?: string; // ISO date
}

/** Keyed by ISO weekday (Mon = 1 … Sun = 7) so labels can be localised. */
export type WeekSchedule = Record<IsoWeekday, string[]>;

export const emptySchedule = (): WeekSchedule => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });

interface WorkoutState {
  workouts: Workout[];
  schedule: WeekSchedule;

  addWorkout: (workout: Workout, days?: IsoWeekday[]) => void;
  updateWorkout: (id: string, updates: Partial<Omit<Workout, 'id'>>, days?: IsoWeekday[]) => void;
  deleteWorkout: (id: string) => void;
  setWorkoutDays: (workoutId: string, days: IsoWeekday[]) => void;
  addSamplePlan: () => void;
  reset: () => void;
}

/** Total minutes: Σ sets × (execution phases + rest), plus standalone rest blocks. */
export function calculateDuration(exercises: readonly Exercise[]): number {
  const seconds = exercises.reduce((acc, ex) => {
    if (ex.type === 'rest') return acc + (ex.restTime || 0);
    const perSet = (ex.executionTime || 0) + (ex.executionTime2 || 0) + (ex.restTime || 0);
    return acc + perSet * (ex.sets || 1);
  }, 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

function withDays(schedule: WeekSchedule, workoutId: string, days: readonly IsoWeekday[]): WeekSchedule {
  const next = emptySchedule();
  for (const day of ISO_WEEKDAYS) {
    const others = schedule[day].filter((id) => id !== workoutId);
    next[day] = days.includes(day) ? [...others, workoutId] : others;
  }
  return next;
}

function sampleWorkouts(): Workout[] {
  const ex = (
    name: string,
    sets: number,
    reps: string,
    restTime: number,
    executionTime: number,
  ): Exercise => ({
    id: newId(),
    name,
    sets,
    reps,
    restTime,
    executionTime,
    type: 'exercise',
  });
  const push = [
    ex('Bench Press', 3, '8-12', 90, 45),
    ex('Overhead Press', 3, '8-12', 90, 45),
    ex('Incline Dumbbell Press', 3, '10-12', 60, 40),
    ex('Lateral Raises', 4, '15-20', 45, 30),
    ex('Tricep Pushdowns', 3, '12-15', 45, 30),
  ];
  const pull = [
    ex('Pull Ups', 3, 'AMRAP', 120, 60),
    ex('Barbell Rows', 3, '8-12', 90, 45),
    ex('Face Pulls', 4, '15-20', 60, 30),
    ex('Bicep Curls', 3, '10-12', 60, 40),
  ];
  return [
    { id: newId(), name: 'Push Day A', exercises: push, duration: calculateDuration(push) },
    { id: newId(), name: 'Pull Day A', exercises: pull, duration: calculateDuration(pull) },
  ];
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      // New installs start empty; the empty state offers an explicit "Add sample plan".
      workouts: [],
      schedule: emptySchedule(),

      addWorkout: (workout, days = []) =>
        set((s) => ({
          workouts: [...s.workouts, workout],
          schedule: withDays(s.schedule, workout.id, days),
        })),

      updateWorkout: (id, updates, days) =>
        set((s) => ({
          workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...updates } : w)),
          schedule: days ? withDays(s.schedule, id, days) : s.schedule,
        })),

      deleteWorkout: (id) =>
        set((s) => ({
          workouts: s.workouts.filter((w) => w.id !== id),
          schedule: withDays(s.schedule, id, []),
        })),

      setWorkoutDays: (workoutId, days) => set((s) => ({ schedule: withDays(s.schedule, workoutId, days) })),

      addSamplePlan: () =>
        set((s) => {
          const [push, pull] = sampleWorkouts();
          if (!push || !pull) return s;
          let schedule = withDays(s.schedule, push.id, [1, 4]);
          schedule = withDays(schedule, pull.id, [2, 5]);
          return { workouts: [...s.workouts, push, pull], schedule };
        }),

      reset: () => set({ workouts: [], schedule: emptySchedule() }),
    }),
    {
      name: 'workout-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persisted, version) => migrateWorkoutState(persisted, version),
    },
  ),
);

export function scheduledDays(schedule: WeekSchedule, workoutId: string): IsoWeekday[] {
  return ISO_WEEKDAYS.filter((d) => schedule[d].includes(workoutId));
}

// ---------------------------------------------------------------------------
// Migrations (exported for tests)
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const DAY_NAMES: Record<string, IsoWeekday> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

function normaliseExercise(raw: unknown): Exercise | null {
  if (!isRecord(raw)) return null;
  const n = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const s = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
  return {
    id: s(raw.id) ?? newId(),
    name: typeof raw.name === 'string' ? raw.name : '',
    sets: n(raw.sets, 3),
    reps: typeof raw.reps === 'string' ? raw.reps : String(raw.reps ?? ''),
    weight: typeof raw.weight === 'number' ? raw.weight : undefined,
    restTime: n(raw.restTime, 60),
    executionTime: n(raw.executionTime, raw.type === 'rest' ? 0 : 45),
    executionName: s(raw.executionName),
    executionTime2:
      typeof raw.executionTime2 === 'number' && raw.executionTime2 > 0 ? raw.executionTime2 : undefined,
    executionName2: s(raw.executionName2),
    notes: s(raw.notes),
    type: raw.type === 'rest' ? 'rest' : 'exercise',
  };
}

/**
 * Collapses every historical shape (v0 string-per-day schedule … v4 name-keyed arrays)
 * into v5. Each field is normalised independently, so a partially-migrated blob is fine.
 */
export function migrateWorkoutState(persisted: unknown, version: number): Partial<WorkoutState> {
  const s = isRecord(persisted) ? persisted : {};
  if (version >= 5) return s as Partial<WorkoutState>;

  const workouts: Workout[] = (Array.isArray(s.workouts) ? s.workouts : []).flatMap((w): Workout[] => {
    if (!isRecord(w) || typeof w.id !== 'string') return [];
    const exercises = (Array.isArray(w.exercises) ? w.exercises : [])
      .map(normaliseExercise)
      .filter((e): e is Exercise => e !== null);
    return [
      {
        id: w.id,
        name: typeof w.name === 'string' ? w.name : '',
        exercises,
        duration: typeof w.duration === 'number' ? w.duration : calculateDuration(exercises),
        lastPerformed: typeof w.lastPerformed === 'string' ? w.lastPerformed : undefined,
      },
    ];
  });

  const schedule = emptySchedule();
  const known = new Set(workouts.map((w) => w.id));
  const rawSchedule = isRecord(s.schedule) ? s.schedule : {};
  for (const [key, value] of Object.entries(rawSchedule)) {
    const day = DAY_NAMES[key] ?? (Number(key) as IsoWeekday);
    if (!ISO_WEEKDAYS.includes(day)) continue;
    const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    schedule[day] = ids.filter((id): id is string => typeof id === 'string' && known.has(id));
  }

  return { workouts, schedule };
}
