import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HeartRateStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'bluetoothOff'
  | 'unauthorized'
  | 'unsupported'
  | 'error';

export interface HeartRateDevice {
  id: string;
  name: string;
}

interface HeartRateState {
  /** The monitor to connect to automatically (remembered). */
  saved: HeartRateDevice | null;
  status: HeartRateStatus;
  /** Monitors seen in the last scan, strongest signal first. */
  found: (HeartRateDevice & { rssi: number })[];
  bpm: number | null;
  /** When the last reading arrived (ms). */
  at: number | null;
  contact: boolean | null;
  set: (patch: Partial<Omit<HeartRateState, 'set' | 'forget'>>) => void;
  forget: () => void;
}

export const useHeartRateStore = create<HeartRateState>()(
  persist(
    (set) => ({
      saved: null,
      status: 'idle',
      found: [],
      bpm: null,
      at: null,
      contact: null,
      set: (patch) => set(patch),
      forget: () => set({ saved: null, bpm: null, at: null, status: 'idle' }),
    }),
    {
      name: 'heart-rate-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ saved: s.saved }),
    },
  ),
);

/** A reading older than this is stale (strap off, out of range). */
export const HR_STALE_MS = 6000;
