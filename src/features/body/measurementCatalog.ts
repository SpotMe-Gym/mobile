import type { TranslationKey } from '@/i18n/keys';
import type { Goal } from '@/features/profile/userStore';
import type { BodySegment, MeasurementKey, Side } from '@/features/body/types';

export type MeasurementGroup = 'primary' | 'advanced';

export interface MeasurementDef {
  key: MeasurementKey;
  group: MeasurementGroup;
  labelKey: TranslationKey;
  side?: Side;
  /** Plausible adult range (cm) — input validation, not a medical claim. */
  min: number;
  max: number;
  /** BIA segment this region belongs to (drives segmental overlays). */
  segment: BodySegment;
  /**
   * Which direction counts as progress for each goal: +1 bigger is better, -1 smaller is
   * better, 0 neutral. Used by the "Progress" colour mode.
   */
  progress: Record<Goal, -1 | 0 | 1>;
}

const GROW = { lose: 0, maintain: 0, gain: 1 } as const;
const LEAN_CORE = { lose: -1, maintain: -1, gain: 0 } as const;
const MUSCLE = { lose: 0, maintain: 1, gain: 1 } as const;
const NEUTRAL = { lose: 0, maintain: 0, gain: 0 } as const;

export const MEASUREMENTS: readonly MeasurementDef[] = [
  { key: 'neck', group: 'primary', labelKey: 'body.m.neck', min: 25, max: 60, segment: 'trunk', progress: GROW },
  { key: 'shoulders', group: 'primary', labelKey: 'body.m.shoulders', min: 80, max: 170, segment: 'trunk', progress: MUSCLE },
  { key: 'chest', group: 'primary', labelKey: 'body.m.chest', min: 60, max: 170, segment: 'trunk', progress: MUSCLE },
  { key: 'waist', group: 'primary', labelKey: 'body.m.waist', min: 50, max: 180, segment: 'trunk', progress: LEAN_CORE },
  { key: 'hips', group: 'primary', labelKey: 'body.m.hips', min: 60, max: 180, segment: 'trunk', progress: { lose: -1, maintain: 0, gain: 0 } },
  { key: 'bicepsL', group: 'primary', labelKey: 'body.m.bicepsL', side: 'L', min: 18, max: 60, segment: 'armL', progress: MUSCLE },
  { key: 'bicepsR', group: 'primary', labelKey: 'body.m.bicepsR', side: 'R', min: 18, max: 60, segment: 'armR', progress: MUSCLE },
  { key: 'thighL', group: 'primary', labelKey: 'body.m.thighL', side: 'L', min: 35, max: 95, segment: 'legL', progress: MUSCLE },
  { key: 'thighR', group: 'primary', labelKey: 'body.m.thighR', side: 'R', min: 35, max: 95, segment: 'legR', progress: MUSCLE },
  { key: 'calfL', group: 'primary', labelKey: 'body.m.calfL', side: 'L', min: 25, max: 60, segment: 'legL', progress: MUSCLE },
  { key: 'calfR', group: 'primary', labelKey: 'body.m.calfR', side: 'R', min: 25, max: 60, segment: 'legR', progress: MUSCLE },

  { key: 'forearmL', group: 'advanced', labelKey: 'body.m.forearmL', side: 'L', min: 18, max: 50, segment: 'armL', progress: MUSCLE },
  { key: 'forearmR', group: 'advanced', labelKey: 'body.m.forearmR', side: 'R', min: 18, max: 50, segment: 'armR', progress: MUSCLE },
  { key: 'wristL', group: 'advanced', labelKey: 'body.m.wristL', side: 'L', min: 12, max: 25, segment: 'armL', progress: NEUTRAL },
  { key: 'wristR', group: 'advanced', labelKey: 'body.m.wristR', side: 'R', min: 12, max: 25, segment: 'armR', progress: NEUTRAL },
  { key: 'upperAbdomen', group: 'advanced', labelKey: 'body.m.upperAbdomen', min: 50, max: 180, segment: 'trunk', progress: LEAN_CORE },
  { key: 'lowerAbdomen', group: 'advanced', labelKey: 'body.m.lowerAbdomen', min: 50, max: 180, segment: 'trunk', progress: LEAN_CORE },
  { key: 'kneeL', group: 'advanced', labelKey: 'body.m.kneeL', side: 'L', min: 25, max: 60, segment: 'legL', progress: NEUTRAL },
  { key: 'kneeR', group: 'advanced', labelKey: 'body.m.kneeR', side: 'R', min: 25, max: 60, segment: 'legR', progress: NEUTRAL },
  { key: 'ankleL', group: 'advanced', labelKey: 'body.m.ankleL', side: 'L', min: 15, max: 35, segment: 'legL', progress: NEUTRAL },
  { key: 'ankleR', group: 'advanced', labelKey: 'body.m.ankleR', side: 'R', min: 15, max: 35, segment: 'legR', progress: NEUTRAL },
];

export const MEASUREMENT_BY_KEY = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, m])) as Record<
  MeasurementKey,
  MeasurementDef
>;

export const MEASUREMENT_KEYS = MEASUREMENTS.map((m) => m.key);

export const isMeasurementKey = (v: unknown): v is MeasurementKey =>
  typeof v === 'string' && v in MEASUREMENT_BY_KEY;
