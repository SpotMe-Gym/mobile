import type { DayKey } from '@/shared/utils/date';

/**
 * Body data model shared by manual tape measurements and BIA (bioelectrical impedance)
 * reports. Everything the 3D body needs is derived from a BodySnapshot, so a new data
 * source only has to produce snapshot fields; the avatar pipeline doesn't change.
 */

export type Side = 'L' | 'R';

/** Circumferences, in cm. `L`/`R` suffix = the user's own left/right. */
export type MeasurementKey =
  // primary
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'bicepsL'
  | 'bicepsR'
  | 'thighL'
  | 'thighR'
  | 'calfL'
  | 'calfR'
  // advanced
  | 'forearmL'
  | 'forearmR'
  | 'wristL'
  | 'wristR'
  | 'upperAbdomen'
  | 'lowerAbdomen'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR';

export type MeasurementValues = Partial<Record<MeasurementKey, number>>;

/** One tape-measure session. Keys not measured that day are simply absent. */
export interface MeasurementEntry {
  id: string;
  source: 'manual';
  day: DayKey;
  /** ISO timestamp — orders several entries on the same day. */
  createdAt: string;
  values: MeasurementValues;
}

// ---------------------------------------------------------------------------
// BIA (bioelectrical impedance analysis)
// ---------------------------------------------------------------------------

/** Body segments reported by 8-electrode BIA scales (InBody, Tanita, Withings…). */
export type BodySegment = 'armL' | 'armR' | 'trunk' | 'legL' | 'legR';

export interface SegmentComposition {
  /** Lean (fat-free) mass of the segment, kg. */
  leanKg?: number;
  /** Fat mass of the segment, kg. */
  fatKg?: number;
}

export interface BiaReport {
  id: string;
  source: 'bia';
  day: DayKey;
  createdAt: string;
  /** Free-text device / app name the report came from. */
  device?: string;
  weightKg?: number;
  bodyFatPct?: number;
  fatMassKg?: number;
  skeletalMuscleKg?: number;
  /** Device-specific visceral fat rating (usually 1–59). */
  visceralFatLevel?: number;
  totalBodyWaterL?: number;
  /** Extracellular water / total body water. */
  ecwRatio?: number;
  basalMetabolicRateKcal?: number;
  segmental?: Partial<Record<BodySegment, SegmentComposition>>;
}

export type BodyRecord = MeasurementEntry | BiaReport;

// ---------------------------------------------------------------------------
// Snapshot — the single input of the avatar pipeline
// ---------------------------------------------------------------------------

export type AvatarGender = 'male' | 'female' | 'neutral';

export interface BodySnapshot {
  gender: AvatarGender;
  heightCm: number;
  weightKg: number;
  /** Latest known value per key on or before the snapshot day (carried forward). */
  measurements: MeasurementValues;
  /** Latest BIA report on or before the snapshot day, if any. */
  composition?: BiaReport;
  /** Day the snapshot describes. */
  day: DayKey;
}
