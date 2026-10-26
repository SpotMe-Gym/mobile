import { carryForward, latestBia } from '@/features/body/bodyStore';
import { MEASUREMENT_KEYS } from '@/features/body/measurementCatalog';
import { toDayKey, type DayKey } from '@/shared/utils/date';
import type { Gender } from '@/features/profile/userStore';
import type { WeightEntry } from '@/features/body-weight/weightStore';
import type {
  AvatarGender,
  BiaReport,
  BodySegment,
  BodySnapshot,
  MeasurementEntry,
  MeasurementKey,
} from '@/features/body/types';

export type CompareTo = 'previous' | 'first';

export interface BodySources {
  gender: Gender | null;
  heightCm: number | null;
  weights: readonly WeightEntry[];
  measurements: readonly MeasurementEntry[];
  biaReports: readonly BiaReport[];
}

export interface SnapshotPair {
  current: BodySnapshot;
  /** What `current` is compared against; null until there are two data points. */
  baseline: BodySnapshot | null;
}

const DEFAULT_HEIGHT: Record<AvatarGender, number> = { male: 175, female: 162, neutral: 168 };
const DEFAULT_BMI = 22.5;

export const avatarGender = (g: Gender | null): AvatarGender => g ?? 'neutral';

function weightOn(weights: readonly WeightEntry[], day: DayKey | undefined): number | undefined {
  let found: number | undefined;
  for (const w of weights) {
    if (day && w.day > day) break;
    found = w.kg;
  }
  // Before the first weigh-in, the first known weight is the best guess.
  return found ?? weights[0]?.kg;
}

function snapshotAt(src: BodySources, entries: readonly MeasurementEntry[], day: DayKey | undefined): BodySnapshot {
  const gender = avatarGender(src.gender);
  const heightCm = src.heightCm && src.heightCm > 0 ? src.heightCm : DEFAULT_HEIGHT[gender];
  const weightKg = weightOn(src.weights, day) ?? DEFAULT_BMI * (heightCm / 100) ** 2;
  return {
    gender,
    heightCm,
    weightKg,
    measurements: carryForward(entries, day),
    composition: latestBia(src.biaReports, day),
    day: day ?? toDayKey(),
  };
}

/**
 * Current body vs a baseline. "previous" = as of the measurement session before the latest
 * one (with the weight known then); "first" = the very first session.
 */
export function buildSnapshots(src: BodySources, compare: CompareTo): SnapshotPair {
  const current = snapshotAt(src, src.measurements, undefined);
  const n = src.measurements.length;
  if (n < 2) return { current, baseline: null };
  const until = compare === 'first' ? src.measurements.slice(0, 1) : src.measurements.slice(0, n - 1);
  const last = until[until.length - 1];
  return { current, baseline: snapshotAt(src, until, last?.day) };
}

/** Per-key change (cm) for keys known in both snapshots. */
export function measurementDeltas(
  current: BodySnapshot,
  baseline: BodySnapshot | null,
): Partial<Record<MeasurementKey, number>> {
  const out: Partial<Record<MeasurementKey, number>> = {};
  if (!baseline) return out;
  for (const key of MEASUREMENT_KEYS) {
    const a = baseline.measurements[key];
    const b = current.measurements[key];
    if (typeof a === 'number' && typeof b === 'number') out[key] = Math.round((b - a) * 10) / 10;
  }
  return out;
}

/** Per-segment lean / fat change between the BIA reports of two snapshots. */
export function segmentDeltas(
  current: BodySnapshot,
  baseline: BodySnapshot | null,
): Partial<Record<BodySegment, { leanKg?: number; fatKg?: number }>> {
  const a = baseline?.composition?.segmental;
  const b = current.composition?.segmental;
  if (!a || !b || baseline?.composition?.id === current.composition?.id) return {};
  const out: Partial<Record<BodySegment, { leanKg?: number; fatKg?: number }>> = {};
  for (const seg of ['armL', 'armR', 'trunk', 'legL', 'legR'] as const) {
    const pa = a[seg];
    const pb = b[seg];
    if (!pa || !pb) continue;
    const d: { leanKg?: number; fatKg?: number } = {};
    if (pa.leanKg !== undefined && pb.leanKg !== undefined) d.leanKg = pb.leanKg - pa.leanKg;
    if (pa.fatKg !== undefined && pb.fatKg !== undefined) d.fatKg = pb.fatKg - pa.fatKg;
    out[seg] = d;
  }
  return out;
}
