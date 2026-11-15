/**
 * "Analyse a machine": the machine's resistance profile, from its geometry alone.
 *
 * Two points are followed in a side-on video: the handle (where the hands or pad push) and the
 * load (the top plate of the weight stack, or the plates on a plate-loaded arm). At any point
 * of the movement, moving the handle a little lifts the load a little; the ratio between the
 * two is the machine's leverage there (virtual work: what you push × how far = weight × how
 * far it rises). Where the load rises a lot per centimetre of handle, the machine is heavy;
 * where it rises little, it's light. Cams, lever arms and pulleys are all inside that ratio,
 * so nothing about the machine's inside has to be known, and no force is measured.
 *
 * The result is the shape of the curve, 0–1 of its own peak, over the range of motion (0 = the
 * start of the lift). If the handle and the load are at different distances from the camera
 * the ratio is off by a constant factor, which the normalisation removes.
 */
import {
  at,
  crossing,
  dist,
  findReps,
  mean,
  median,
  repPhases,
  smooth,
  std,
  type Vec,
} from '@/features/motion/analysis/signal';
import { pointSeries, toFrame, type Track } from '@/features/motion/analysis/track';
import { decimate } from '@/features/motion/analysis/execution';

export type ProfileShape = 'ascending' | 'descending' | 'bell' | 'valley' | 'flat';

export interface MachineResult {
  /** Relative resistance (0–1 of the peak) at even steps of the range of motion. */
  profile: number[];
  shape: ProfileShape;
  /** Where the resistance peaks (0 = start of the lift, 1 = end). */
  peakAt: number;
  /** Mean relative resistance in the first, middle and last third. */
  thirds: [number, number, number];
  /** Lightest point as a share of the peak. */
  lowest: number;
  /** Load travel per handle travel over the whole lift (approximate: depends on camera depth). */
  ratio: number;
  /** Lifts the curve was averaged over. */
  reps: number;
  /** How alike the lifts' curves were, and how well the points were tracked. */
  confidence: 'high' | 'medium' | 'low';
  /** With a pivot marked: the arm's swing in degrees, and how round its arc was (1 = perfect). */
  arm: { degrees: number; roundness: number } | null;
  /** For drawing, in 0–1 frame coordinates. */
  drawing: {
    handle: Vec[];
    load: Vec[];
    pivot: Vec | null;
    /** Handle position at the start and the end of the lift. */
    handleStart: Vec | null;
    handleEnd: Vec | null;
  };
  tracked: number;
}

export const PROFILE_STEPS = 21;

export interface MachineOptions {
  handle?: number;
  load?: number;
  /** Index of the pivot among the marked points, when it was marked. */
  pivot?: number | null;
}

/** Names the curve from its thirds. */
export function classify(profile: readonly number[]): ProfileShape {
  const [a, b, c] = thirds(profile);
  const lowest = Math.min(...profile);
  if (1 - lowest < 0.15) return 'flat';
  const edge = (a + c) / 2;
  if (b - edge > 0.08 && b >= a && b >= c) return 'bell';
  if (edge - b > 0.08 && b <= a && b <= c) return 'valley';
  return c >= a ? 'ascending' : 'descending';
}

export function thirds(profile: readonly number[]): [number, number, number] {
  const n = profile.length;
  const cut = (from: number, to: number) => mean(profile.slice(Math.floor(from * n), Math.ceil(to * n)));
  return [cut(0, 1 / 3), cut(1 / 3, 2 / 3), cut(2 / 3, 1)];
}

export function analyzeMachine(track: Track, options: MachineOptions = {}): MachineResult | null {
  const handle = pointSeries(track, options.handle ?? 0, 7);
  const load = pointSeries(track, options.load ?? 1, 7);
  const pivotSeries =
    options.pivot === null || options.pivot === undefined ? null : pointSeries(track, options.pivot, 7);
  const aspect = handle.aspect;
  if (handle.points.length < 10) return null;

  // Height of the load (up is positive; the picture's y grows downwards).
  const rest = load.points[0]!.y;
  const height = load.points.map((p) => rest - p.y);
  const spans = findReps(height);
  if (spans.length === 0) return null;

  const curves: number[][] = [];
  const ratios: number[] = [];
  let first: { from: number; to: number } | null = null;
  for (const span of spans) {
    const { leave } = repPhases(height, span, 0.03);
    const from = leave;
    const to = span.peak;
    if (to - from < 6) continue;
    first ??= { from, to };

    // Handle travel along its own path since the lift began.
    const travel: number[] = [0];
    for (let i = from + 1; i <= to; i++)
      travel.push(travel[travel.length - 1]! + dist(handle.points[i]!, handle.points[i - 1]!));
    const total = travel[travel.length - 1]!;
    const rise = height[to]! - height[from]!;
    if (!(total > 0) || !(rise > 0)) continue;
    ratios.push(rise / total);

    // Load height at even steps of handle travel, then its slope: the leverage at each step.
    const h: number[] = [];
    for (let k = 0; k < PROFILE_STEPS; k++) {
      const i = crossing(travel, 0, travel.length - 1, (total * k) / (PROFILE_STEPS - 1));
      h.push(at(height, from + i));
    }
    const slope = h.map((_, k) => {
      const lo = Math.max(0, k - 2);
      const hi = Math.min(PROFILE_STEPS - 1, k + 2);
      return Math.max(0, (h[hi]! - h[lo]!) / (hi - lo));
    });
    curves.push(slope);
  }
  if (curves.length === 0) return null;

  const raw = smooth(
    Array.from({ length: PROFILE_STEPS }, (_, k) => median(curves.map((c) => c[k]!))),
    3,
  );
  const peak = Math.max(...raw);
  if (!(peak > 0)) return null;
  const profile = raw.map((v) => Math.round((v / peak) * 1000) / 1000);

  // Agreement between the lifts: spread of their normalised curves.
  const spread =
    curves.length < 2
      ? 0.2
      : mean(
          Array.from({ length: PROFILE_STEPS }, (_, k) =>
            std(curves.map((c) => c[k]! / Math.max(1e-9, Math.max(...c)))),
          ),
        );
  const tracked = Math.min(handle.tracked, load.tracked);
  const confidence: MachineResult['confidence'] =
    tracked >= 0.9 && spread < 0.08 && curves.length >= 2
      ? 'high'
      : tracked >= 0.75 && spread < 0.16
        ? 'medium'
        : 'low';

  let arm: MachineResult['arm'] = null;
  let pivot: Vec | null = null;
  if (pivotSeries && first) {
    // The pivot doesn't move: its median position is steadier than any single frame.
    pivot = {
      x: median(pivotSeries.points.map((p) => p.x)),
      y: median(pivotSeries.points.map((p) => p.y)),
    };
    const radii: number[] = [];
    for (let i = first.from; i <= first.to; i++) radii.push(dist(handle.points[i]!, pivot));
    const a = handle.points[first.from]!;
    const b = handle.points[first.to]!;
    let swing = Math.atan2(b.y - pivot.y, b.x - pivot.x) - Math.atan2(a.y - pivot.y, a.x - pivot.x);
    while (swing > Math.PI) swing -= 2 * Math.PI;
    while (swing < -Math.PI) swing += 2 * Math.PI;
    const r = mean(radii);
    arm = {
      degrees: Math.round((Math.abs(swing) * 180) / Math.PI),
      roundness: r > 0 ? Math.max(0, 1 - std(radii) / r) : 0,
    };
  }

  const peakAt = profile.indexOf(Math.max(...profile)) / (PROFILE_STEPS - 1);
  const slice = (pts: readonly Vec[]) =>
    decimate(pts.slice(spans[0]!.start, spans[spans.length - 1]!.end + 1), 120).map((p) =>
      toFrame(p, aspect),
    );
  return {
    profile,
    shape: classify(profile),
    peakAt,
    thirds: thirds(profile),
    lowest: Math.min(...profile),
    ratio: mean(ratios),
    reps: curves.length,
    confidence,
    arm,
    drawing: {
      handle: slice(handle.points),
      load: slice(load.points),
      pivot: pivot ? toFrame(pivot, aspect) : null,
      handleStart: first ? toFrame(handle.points[first.from]!, aspect) : null,
      handleEnd: first ? toFrame(handle.points[first.to]!, aspect) : null,
    },
    tracked,
  };
}
