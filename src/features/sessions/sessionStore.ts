import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/shared/lib/ids';
import type { Exercise, Workout } from '@/features/workouts/workoutStore';
import { exerciseKey } from '@/features/exercises/resolve';
import type { PlayerState } from '@/features/sessions/player';

/** One set actually done. Weight is always kg. */
export interface LoggedSet {
  id: string;
  /** The block (exercise entry) of the plan it belongs to. */
  blockId: string;
  exerciseId?: string;
  exerciseName: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  durationSec?: number | null;
  /** Effort, 1–10. */
  rpe?: number | null;
  completedAt: string;
}

/** Heart rate during a session, from a Bluetooth monitor. Samples are [seconds since start, bpm]. */
export interface HeartRateLog {
  samples: [number, number][];
  avg: number;
  max: number;
  min: number;
}

/** Keep one sample every this many seconds (about 720 for an hour). */
export const HR_SAMPLE_EVERY_SEC = 5;

/** Adds a reading to the log (at most one sample per HR_SAMPLE_EVERY_SEC). */
export function addHeartRateSample(log: HeartRateLog | undefined, atSec: number, bpm: number): HeartRateLog {
  const t = Math.max(0, Math.round(atSec));
  const b = Math.round(bpm);
  if (!log || log.samples.length === 0) return { samples: [[t, b]], avg: b, max: b, min: b };
  const last = log.samples[log.samples.length - 1]!;
  if (t - last[0] < HR_SAMPLE_EVERY_SEC) return log;
  const n = log.samples.length;
  return {
    samples: [...log.samples, [t, b]],
    avg: Math.round(((log.avg * n + b) / (n + 1)) * 10) / 10,
    max: Math.max(log.max, b),
    min: Math.min(log.min, b),
  };
}

/** A workout as it was done. `plan` is a copy, so later edits to the workout don't rewrite history. */
export interface WorkoutSession {
  id: string;
  workoutId: string | null;
  name: string;
  startedAt: string;
  endedAt: string | null;
  plan: Exercise[];
  sets: LoggedSet[];
  notes?: string;
  heartRate?: HeartRateLog;
  /** Where the workout player is (this device only, not synced). */
  player?: PlayerState;
}

interface SessionState {
  sessions: WorkoutSession[];
  start: (workout: Pick<Workout, 'id' | 'name' | 'exercises'> | null, name?: string) => WorkoutSession;
  logSet: (sessionId: string, set: Omit<LoggedSet, 'id' | 'completedAt'>) => void;
  updateSet: (
    sessionId: string,
    setId: string,
    patch: Partial<Pick<LoggedSet, 'reps' | 'weightKg' | 'rpe'>>,
  ) => void;
  removeSet: (sessionId: string, setId: string) => void;
  /** Adds an exercise to the session's plan (quick start, or one more exercise on the day). */
  addBlock: (sessionId: string, block: Exercise) => void;
  setPlayer: (sessionId: string, player: PlayerState) => void;
  addHeartRate: (sessionId: string, bpm: number, at?: number) => void;
  finish: (sessionId: string) => void;
  discard: (sessionId: string) => void;
  reset: () => void;
}

const mapSession = (list: WorkoutSession[], id: string, fn: (s: WorkoutSession) => WorkoutSession) =>
  list.map((s) => (s.id === id ? fn(s) : s));

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      start: (workout, name) => {
        const session: WorkoutSession = {
          id: newId(),
          workoutId: workout?.id ?? null,
          name: workout?.name ?? name ?? 'Workout',
          startedAt: new Date().toISOString(),
          endedAt: null,
          plan: workout ? workout.exercises.map((e) => ({ ...e })) : [],
          sets: [],
        };
        set({ sessions: [...get().sessions, session] });
        return session;
      },
      logSet: (sessionId, input) =>
        set((s) => ({
          sessions: mapSession(s.sessions, sessionId, (x) => ({
            ...x,
            sets: [...x.sets, { ...input, id: newId(), completedAt: new Date().toISOString() }],
          })),
        })),
      updateSet: (sessionId, setId, patch) =>
        set((s) => ({
          sessions: mapSession(s.sessions, sessionId, (x) => ({
            ...x,
            sets: x.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)),
          })),
        })),
      removeSet: (sessionId, setId) =>
        set((s) => ({
          sessions: mapSession(s.sessions, sessionId, (x) => ({
            ...x,
            sets: x.sets.filter((st) => st.id !== setId),
          })),
        })),
      addBlock: (sessionId, block) =>
        set((s) => ({
          sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, plan: [...x.plan, block] })),
        })),
      setPlayer: (sessionId, player) =>
        set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, player })) })),
      addHeartRate: (sessionId, bpm, at = Date.now()) => {
        if (!Number.isFinite(bpm) || bpm < 25 || bpm > 250) return;
        const session = get().sessions.find((x) => x.id === sessionId);
        if (!session || session.endedAt) return;
        const next = addHeartRateSample(session.heartRate, (at - Date.parse(session.startedAt)) / 1000, bpm);
        if (next === session.heartRate) return;
        set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, heartRate: next })) }));
      },
      finish: (sessionId) =>
        set((s) => ({
          sessions: mapSession(s.sessions, sessionId, ({ player: _player, ...x }) => ({
            ...x,
            endedAt: x.endedAt ?? new Date().toISOString(),
          })),
        })),
      discard: (sessionId) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== sessionId) })),
      reset: () => set({ sessions: [] }),
    }),
    { name: 'session-storage', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** The session in progress, if any (the newest one without an end). */
export const selectActiveSession = (s: Pick<SessionState, 'sessions'>): WorkoutSession | undefined =>
  [...s.sessions].reverse().find((x) => x.endedAt === null);

/** Estimated one-rep max (Epley), only for weighted sets of 1–12 reps. */
export function estimatedOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

const keyOf = (st: Pick<LoggedSet, 'exerciseId' | 'exerciseName'>) =>
  exerciseKey(st.exerciseId, st.exerciseName);

/** Sets of the most recent finished session that included this exercise, in order. */
export function lastPerformance(
  sessions: readonly WorkoutSession[],
  exerciseId: string | undefined,
  name: string,
  beforeSessionId?: string,
): LoggedSet[] {
  const key = exerciseKey(exerciseId, name);
  const done = sessions.filter((s) => s.endedAt !== null && s.id !== beforeSessionId);
  for (let i = done.length - 1; i >= 0; i--) {
    const sets = done[i]!.sets.filter((st) => keyOf(st) === key);
    if (sets.length) return [...sets].sort((a, b) => a.setIndex - b.setIndex);
  }
  return [];
}

/** Best estimated 1RM per exercise across finished sessions (optionally excluding one). */
export function bestOneRepMaxes(
  sessions: readonly WorkoutSession[],
  excludeSessionId?: string,
): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of sessions) {
    if (s.endedAt === null || s.id === excludeSessionId) continue;
    for (const st of s.sets) {
      const e = estimatedOneRepMax(st.weightKg, st.reps);
      if (e === null) continue;
      const k = keyOf(st);
      if (e > (best.get(k) ?? 0)) best.set(k, e);
    }
  }
  return best;
}

export interface SessionSummary {
  sets: number;
  volumeKg: number;
  minutes: number;
  records: { name: string; oneRepMaxKg: number }[];
}

/** Totals for a session, and the exercises where it beat the previous best 1RM. */
export function summarizeSession(session: WorkoutSession, all: readonly WorkoutSession[]): SessionSummary {
  const previous = bestOneRepMaxes(all, session.id);
  const top = new Map<string, { name: string; e: number }>();
  let volumeKg = 0;
  for (const st of session.sets) {
    volumeKg += (st.weightKg ?? 0) * (st.reps ?? 0);
    const e = estimatedOneRepMax(st.weightKg, st.reps);
    if (e === null) continue;
    const k = keyOf(st);
    if (e > (top.get(k)?.e ?? 0)) top.set(k, { name: st.exerciseName, e });
  }
  const records = [...top.entries()]
    .filter(([k, v]) => previous.has(k) && v.e > (previous.get(k) ?? 0) + 1e-9)
    .map(([, v]) => ({ name: v.name, oneRepMaxKg: Math.round(v.e * 10) / 10 }));
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
  return {
    sets: session.sets.length,
    volumeKg: Math.round(volumeKg),
    minutes: Math.max(1, Math.round((end - Date.parse(session.startedAt)) / 60000)),
    records,
  };
}
