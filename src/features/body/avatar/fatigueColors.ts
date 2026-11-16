import type { Muscle } from '@/features/exercises/library';
import type { MuscleFatigue } from '@/features/sessions/fatigue';
import { LEVELS } from '@/features/sessions/fatigue';
import { SKIN, type Rgb } from '@/features/body/avatar/zoneColors';
import type { AvatarModel } from '@/features/body/avatar/types';
import type { MeasurementKey } from '@/features/body/types';

/**
 * Where each muscle shows on the body. The body's zones are the tape-measure bands, so front
 * and back share a band (chest and upper back both light the chest band); the list under the
 * body is the precise, per-muscle view.
 */
export const MUSCLE_ZONES: Record<Muscle, MeasurementKey[]> = {
  chest: ['chest'],
  lats: ['chest'],
  'middle back': ['chest'],
  shoulders: ['shoulders'],
  traps: ['shoulders', 'neck'],
  neck: ['neck'],
  biceps: ['bicepsL', 'bicepsR'],
  triceps: ['bicepsL', 'bicepsR'],
  forearms: ['forearmL', 'forearmR'],
  abdominals: ['upperAbdomen', 'waist', 'lowerAbdomen'],
  'lower back': ['waist'],
  glutes: ['hips'],
  abductors: ['hips'],
  quadriceps: ['thighL', 'thighR'],
  hamstrings: ['thighL', 'thighR'],
  adductors: ['thighL', 'thighR'],
  calves: ['calfL', 'calfR'],
};

/** Linear-space colours of the fatigue scale: light, moderate, high. */
export const FATIGUE_COLORS: { light: Rgb; moderate: Rgb; high: Rgb } = {
  light: [0.95, 0.72, 0.1],
  moderate: [0.95, 0.4, 0.05],
  high: [0.91, 0.12, 0.12],
};

/** The scale as a colour for a fatigue of 0–1 (null below "light": the skin shows). */
export function fatigueColor(fatigue: number): Rgb | null {
  if (fatigue < LEVELS.light) return null;
  const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  if (fatigue < LEVELS.moderate) return FATIGUE_COLORS.light;
  if (fatigue < LEVELS.high) {
    return mix(
      FATIGUE_COLORS.moderate,
      FATIGUE_COLORS.high,
      (fatigue - LEVELS.moderate) / (LEVELS.high - LEVELS.moderate) / 2,
    );
  }
  return FATIGUE_COLORS.high;
}

/** The most fatigued muscle of each zone decides the zone's colour. */
export function zoneFatigue(list: readonly MuscleFatigue[]): Partial<Record<MeasurementKey, number>> {
  const out: Partial<Record<MeasurementKey, number>> = {};
  for (const m of list) {
    for (const zone of MUSCLE_ZONES[m.muscle]) out[zone] = Math.max(out[zone] ?? 0, m.fatigue);
  }
  return out;
}

/** Per-vertex RGB: skin, tinted by each zone's fatigue (the strongest tint wins on overlaps). */
export function buildFatigueColors(model: AvatarModel, list: readonly MuscleFatigue[]): Float32Array {
  const n = model.vertexCount;
  const colors = new Float32Array(n * 3);
  const amount = new Float32Array(n);
  const tint = new Float32Array(n * 3);
  for (const [key, fatigue] of Object.entries(zoneFatigue(list)) as [MeasurementKey, number][]) {
    const color = fatigueColor(fatigue);
    const zone = model.zones[key];
    if (!color || !zone) continue;
    const strength = 0.55 + 0.45 * fatigue;
    for (let i = 0; i < zone.indices.length; i++) {
      const v = zone.indices[i] ?? 0;
      const a = (zone.weights[i] ?? 0) * strength;
      if (a > (amount[v] ?? 0)) {
        amount[v] = a;
        tint.set(color, v * 3);
      }
    }
  }
  for (let v = 0; v < n; v++) {
    const a = amount[v] ?? 0;
    for (let c = 0; c < 3; c++) {
      const skin = SKIN[c] ?? 0;
      colors[v * 3 + c] = skin + ((tint[v * 3 + c] ?? 0) - skin) * a;
    }
  }
  return colors;
}
