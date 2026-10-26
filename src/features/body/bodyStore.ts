import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/shared/lib/ids';
import { isDayKey, toDayKey, type DayKey } from '@/shared/utils/date';
import { isMeasurementKey } from '@/features/body/measurementCatalog';
import type {
  BiaReport,
  MeasurementEntry,
  MeasurementKey,
  MeasurementValues,
} from '@/features/body/types';

interface BodyState {
  /** Sorted oldest → newest. */
  measurements: MeasurementEntry[];
  /** Sorted oldest → newest. Filled by future BIA importers. */
  biaReports: BiaReport[];
  addMeasurements: (values: MeasurementValues, day?: DayKey) => void;
  updateMeasurements: (id: string, values: MeasurementValues) => void;
  removeMeasurements: (id: string) => void;
  addBiaReport: (report: Omit<BiaReport, 'id' | 'source' | 'createdAt'> & { day?: DayKey }) => void;
  removeBiaReport: (id: string) => void;
  reset: () => void;
}

const byDate = <T extends { day: DayKey; createdAt: string }>(a: T, b: T) =>
  a.day === b.day ? a.createdAt.localeCompare(b.createdAt) : a.day.localeCompare(b.day);

/** Drops unknown keys and non-positive / non-finite numbers; rounds to 0.1 cm. */
export function cleanValues(values: MeasurementValues): MeasurementValues {
  const out: MeasurementValues = {};
  for (const [key, raw] of Object.entries(values)) {
    if (!isMeasurementKey(key)) continue;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue;
    out[key as MeasurementKey] = Math.round(raw * 10) / 10;
  }
  return out;
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set) => ({
      measurements: [],
      biaReports: [],
      addMeasurements: (values, day = toDayKey()) => {
        const clean = cleanValues(values);
        if (Object.keys(clean).length === 0) return;
        set((s) => ({
          measurements: [
            ...s.measurements,
            { id: newId(), source: 'manual' as const, day, createdAt: new Date().toISOString(), values: clean },
          ].sort(byDate),
        }));
      },
      updateMeasurements: (id, values) =>
        set((s) => ({
          measurements: s.measurements.map((m) => (m.id === id ? { ...m, values: cleanValues(values) } : m)),
        })),
      removeMeasurements: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
      addBiaReport: ({ day = toDayKey(), ...report }) =>
        set((s) => ({
          biaReports: [
            ...s.biaReports,
            { ...report, id: newId(), source: 'bia' as const, day, createdAt: new Date().toISOString() },
          ].sort(byDate),
        })),
      removeBiaReport: (id) => set((s) => ({ biaReports: s.biaReports.filter((r) => r.id !== id) })),
      reset: () => set({ measurements: [], biaReports: [] }),
    }),
    {
      name: 'body-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => sanitizeBodyState(persisted),
    },
  ),
);

/** Defensive load: keeps only well-formed records. Exported for tests. */
export function sanitizeBodyState(persisted: unknown): Pick<BodyState, 'measurements' | 'biaReports'> {
  const s = typeof persisted === 'object' && persisted !== null ? (persisted as Record<string, unknown>) : {};
  const measurements = Array.isArray(s.measurements)
    ? s.measurements
        .filter((m): m is MeasurementEntry => typeof m === 'object' && m !== null && isDayKey((m as MeasurementEntry).day))
        .map((m) => ({ ...m, source: 'manual' as const, values: cleanValues(m.values ?? {}) }))
    : [];
  const biaReports = Array.isArray(s.biaReports)
    ? s.biaReports.filter((r): r is BiaReport => typeof r === 'object' && r !== null && isDayKey((r as BiaReport).day))
    : [];
  return { measurements: measurements.sort(byDate), biaReports: biaReports.sort(byDate) };
}

/**
 * Values known on `day`: for each key, the latest measurement taken on or before that day.
 * Measuring only your arms today keeps last week's waist in the picture.
 */
export function carryForward(entries: readonly MeasurementEntry[], day?: DayKey): MeasurementValues {
  const out: MeasurementValues = {};
  for (const entry of entries) {
    if (day && entry.day > day) break;
    Object.assign(out, entry.values);
  }
  return out;
}

/** Latest BIA report on or before `day`. */
export function latestBia(reports: readonly BiaReport[], day?: DayKey): BiaReport | undefined {
  let found: BiaReport | undefined;
  for (const r of reports) {
    if (day && r.day > day) break;
    found = r;
  }
  return found;
}
