import { MEASUREMENT_BY_KEY } from '@/features/body/measurementCatalog';
import type { Goal } from '@/features/profile/userStore';
import type { BodySegment, MeasurementKey } from '@/features/body/types';
import type { AvatarModel } from '@/features/body/avatar/types';

export type HighlightMode = 'progress' | 'change';
export type Tone = 'good' | 'bad' | 'neutral';

export type Rgb = readonly [number, number, number];

/** Linear-space colours (three.js vertex colours are linear). */
export const SKIN: Rgb = [0.55, 0.36, 0.26];
export const GOOD: Rgb = [0.13, 0.75, 0.29];
export const BAD: Rgb = [0.91, 0.18, 0.18];

/** Below this, a change is noise (tape precision ≈ ±0.5 cm). */
export const MIN_CHANGE_CM = 0.3;
/** A change this large paints the zone at full strength. */
const FULL_CHANGE_CM = 2.5;
/** Any real change is clearly visible, even a small one. */
const MIN_STRENGTH = 0.45;
/** Segment overlays (BIA) are fainter than tape zones. */
const SEGMENT_STRENGTH = 0.55;
const FULL_SEGMENT_CHANGE_KG = 0.5;

/**
 * Green / red per measurement:
 * - change   → green = it grew, red = it shrank;
 * - progress → green = moved the way your goal wants (catalog `progress`), red = the
 *              other way, nothing when the goal doesn't care about that region.
 */
export function toneFor(key: MeasurementKey, deltaCm: number, mode: HighlightMode, goal: Goal): Tone {
  if (Math.abs(deltaCm) < MIN_CHANGE_CM) return 'neutral';
  if (mode === 'change') return deltaCm > 0 ? 'good' : 'bad';
  const want = MEASUREMENT_BY_KEY[key].progress[goal];
  if (want === 0) return 'neutral';
  return Math.sign(deltaCm) === want ? 'good' : 'bad';
}

export interface ZoneHighlight {
  key: MeasurementKey;
  tone: Tone;
  /** 0–1 */
  strength: number;
}

export function zoneHighlights(
  deltas: Partial<Record<MeasurementKey, number>>,
  mode: HighlightMode,
  goal: Goal,
): ZoneHighlight[] {
  const out: ZoneHighlight[] = [];
  for (const [key, delta] of Object.entries(deltas) as [MeasurementKey, number][]) {
    const tone = toneFor(key, delta, mode, goal);
    if (tone === 'neutral') continue;
    const t = Math.min(1, Math.abs(delta) / FULL_CHANGE_CM);
    out.push({ key, tone, strength: MIN_STRENGTH + (1 - MIN_STRENGTH) * t });
  }
  return out;
}

export interface SegmentHighlight {
  segment: BodySegment;
  tone: Tone;
  strength: number;
}

/** BIA segmental change → highlight (lean mass up = good; fat mass up = bad). */
export function segmentHighlights(
  changes: Partial<Record<BodySegment, { leanKg?: number; fatKg?: number }>>,
): SegmentHighlight[] {
  const out: SegmentHighlight[] = [];
  for (const [segment, c] of Object.entries(changes) as [
    BodySegment,
    { leanKg?: number; fatKg?: number },
  ][]) {
    const score = (c.leanKg ?? 0) - (c.fatKg ?? 0);
    if (Math.abs(score) < 0.1) continue;
    out.push({
      segment,
      tone: score > 0 ? 'good' : 'bad',
      strength: SEGMENT_STRENGTH * Math.min(1, Math.abs(score) / FULL_SEGMENT_CHANGE_KG),
    });
  }
  return out;
}

/**
 * Per-vertex RGB: skin, blended toward green / red by zone weight × strength. Overlapping
 * zones keep the strongest tint per vertex instead of muddying into brown.
 */
export function buildVertexColors(
  model: AvatarModel,
  zones: readonly ZoneHighlight[],
  segments: readonly SegmentHighlight[] = [],
  out?: Float32Array,
): Float32Array {
  const n = model.vertexCount;
  const colors = out && out.length === n * 3 ? out : new Float32Array(n * 3);
  const amount = new Float32Array(n);
  const tone = new Int8Array(n); // 1 good, -1 bad

  const paint = (v: number, a: number, t: Tone) => {
    if (a > (amount[v] ?? 0)) {
      amount[v] = a;
      tone[v] = t === 'good' ? 1 : -1;
    }
  };

  if (segments.length > 0) {
    const segOfPart = model.calibration.parts.map((p) => model.calibration.segments[p]);
    for (let v = 0; v < n; v++) {
      const seg = segOfPart[model.parts[v] ?? 0];
      const h = segments.find((s) => s.segment === seg);
      if (h) paint(v, h.strength, h.tone);
    }
  }
  for (const z of zones) {
    const zone = model.zones[z.key];
    if (!zone) continue;
    for (let i = 0; i < zone.indices.length; i++)
      paint(zone.indices[i] ?? 0, (zone.weights[i] ?? 0) * z.strength, z.tone);
  }

  for (let v = 0; v < n; v++) {
    const a = amount[v] ?? 0;
    const target = tone[v] === 1 ? GOOD : BAD;
    for (let c = 0; c < 3; c++) {
      const skin = SKIN[c] ?? 0;
      colors[v * 3 + c] = skin + ((target[c] ?? 0) - skin) * a;
    }
  }
  return colors;
}
