import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userMMKV, LEGACY_WEIGHT_KEY } from '@/lib/storage';
import { newId } from '@/lib/ids';
import { isDayKey, toDayKey, type DayKey } from '@/utils/date';
import { reportError } from '@/lib/reporting';

export interface WeightEntry {
  id: string;
  day: DayKey;
  kg: number;
  /** ISO timestamp — orders several entries on the same day. */
  createdAt: string;
}

interface WeightState {
  /** Sorted oldest → newest. Unbounded history: lives in AsyncStorage, not MMKV. */
  entries: WeightEntry[];
  addEntry: (kg: number, day?: DayKey) => void;
  removeEntry: (id: string) => void;
  reset: () => void;
}

const byDate = (a: WeightEntry, b: WeightEntry) =>
  a.day === b.day ? a.createdAt.localeCompare(b.createdAt) : a.day.localeCompare(b.day);

export const useWeightStore = create<WeightState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (kg, day = toDayKey()) =>
        set((s) => ({
          entries: [...s.entries, { id: newId(), day, kg, createdAt: new Date().toISOString() }].sort(byDate),
        })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      reset: () => set({ entries: [] }),
    }),
    {
      name: 'weight-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) importLegacyWeightHistory(state);
      },
    },
  ),
);

/** Latest entry, or undefined. */
export const selectLatestWeight = (s: WeightState): WeightEntry | undefined =>
  s.entries[s.entries.length - 1];
/** Entry before the latest, for trend arrows. */
export const selectPreviousWeight = (s: WeightState): WeightEntry | undefined =>
  s.entries[s.entries.length - 2];

/** Converts the v0 user-store history (handed off via MMKV) into entries. Exported for tests. */
export function convertLegacyWeights(raw: unknown): WeightEntry[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const { history, current } = raw as { history?: unknown; current?: unknown };
  const out: WeightEntry[] = [];
  if (Array.isArray(history)) {
    for (const item of history) {
      if (typeof item !== 'object' || item === null) continue;
      const { date, weight } = item as { date?: unknown; weight?: unknown };
      const kg = typeof weight === 'number' ? weight : Number(weight);
      if (!Number.isFinite(kg) || kg <= 0) continue;
      const day = isDayKey(date) ? date : toDayKey();
      out.push({ id: newId(), day, kg, createdAt: `${day}T12:00:00.000Z` });
    }
  }
  if (out.length === 0 && typeof current === 'number' && current > 0) {
    const day = toDayKey();
    out.push({ id: newId(), day, kg: current, createdAt: new Date().toISOString() });
  }
  return out.sort(byDate);
}

function importLegacyWeightHistory(state: WeightState) {
  try {
    const raw = userMMKV.getString(LEGACY_WEIGHT_KEY);
    if (!raw) return;
    const imported = convertLegacyWeights(JSON.parse(raw));
    if (imported.length > 0 && state.entries.length === 0) {
      useWeightStore.setState({ entries: imported });
    }
    userMMKV.remove(LEGACY_WEIGHT_KEY);
  } catch (error) {
    reportError(error, { context: 'weightStore.importLegacy' });
  }
}
