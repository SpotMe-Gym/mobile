import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/shared/lib/ids';
import type { ExecutionResult } from '@/features/motion/analysis/execution';
import type { MachineResult } from '@/features/motion/analysis/machine';
import type { MachineFit, MovementId } from '@/features/motion/analysis/movements';

/**
 * Motion Lab's results. Only the numbers and a still picture are kept: the video is analysed
 * on the phone and not stored.
 */
interface RecordBase {
  id: string;
  createdAt: string;
  /** The exercise or machine, as the user named it. */
  name: string;
  /** Still frame behind the drawing (file:// in the app's storage), if it could be saved. */
  image: string | null;
  /** Frame width / height. */
  aspect: number;
}

export interface ExecutionRecord extends RecordBase {
  kind: 'execution';
  /** The analysed machine this set was done on, when one was picked. */
  machineId?: string;
  result: ExecutionResult;
}

export interface MachineRecord extends RecordBase {
  kind: 'machine';
  movement: MovementId;
  result: MachineResult;
  fit: MachineFit;
}

export type MotionRecord = ExecutionRecord | MachineRecord;

type NewRecord = Omit<ExecutionRecord, 'id' | 'createdAt'> | Omit<MachineRecord, 'id' | 'createdAt'>;

interface MotionState {
  /** Newest first. */
  records: MotionRecord[];
  add: (record: NewRecord) => string;
  remove: (id: string) => void;
  reset: () => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      records: [],
      add: (record) => {
        const id = newId();
        const full = { ...record, id, createdAt: new Date().toISOString() } as MotionRecord;
        set((s) => ({ records: [full, ...s.records] }));
        return id;
      },
      remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
      reset: () => set({ records: [] }),
    }),
    { name: 'motion-storage', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** The analysed machines (derive with useMemo: a fresh array every call). */
export const machinesOf = (records: readonly MotionRecord[]) =>
  records.filter((r): r is MachineRecord => r.kind === 'machine');

/**
 * The results as compact data for the AI coach: no drawings, just what was measured. Small
 * enough to send whole (a few lines per record).
 */
export function motionForAi(records: readonly MotionRecord[], limit = 20) {
  const pct = (v: number) => Math.round(v * 100);
  return records.slice(0, limit).map((r) =>
    r.kind === 'machine'
      ? {
          kind: r.kind,
          date: r.createdAt.slice(0, 10),
          machine: r.name,
          movement: r.movement,
          shape: r.result.shape,
          peakAtPct: pct(r.result.peakAt),
          resistanceByThirdPct: r.result.thirds.map(pct),
          matchPct: r.fit.match === null ? null : pct(r.fit.match),
          verdict: r.fit.verdict,
          notes: r.fit.notes,
          confidence: r.result.confidence,
        }
      : {
          kind: r.kind,
          date: r.createdAt.slice(0, 10),
          exercise: r.name,
          reps: r.result.reps.length,
          score: r.result.score,
          rangeConsistencyPct: pct(r.result.rangeConsistency),
          pathDeviationPct: pct(r.result.pathDeviation),
          speedLossPct: pct(r.result.speedLoss),
          tempoSec: {
            out: Math.round(r.result.tempo.outSec * 10) / 10,
            hold: Math.round(r.result.tempo.holdSec * 10) / 10,
            back: Math.round(r.result.tempo.backSec * 10) / 10,
          },
          joint: r.result.joint,
          flaggedReps: r.result.reps.filter((x) => x.flags.length > 0).length,
        },
  );
}
