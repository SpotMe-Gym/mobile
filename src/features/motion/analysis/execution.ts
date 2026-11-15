/**
 * "Record my execution": from the tracked handle (or bar) and the body's joints, how each
 * repetition was done: range, tempo, speed, and how closely it followed the same path.
 *
 * Everything is relative (to the best rep, to the range of motion), so no ruler is needed in
 * the picture.
 */
import {
  at,
  crossing,
  dist,
  fillGaps,
  findReps,
  mean,
  principalAxis,
  quantile,
  repPhases,
  smooth,
  std,
  type RepSpan,
  type Vec,
} from '@/features/motion/analysis/signal';
import {
  MIN_CONFIDENCE,
  pointSeries,
  times,
  toFrame,
  type JointName,
  type Track,
} from '@/features/motion/analysis/track';

export type RepFlag = 'shortRange' | 'offPath' | 'rushedReturn';

export interface RepMetrics {
  /** Range of motion as a share of the best rep (1 = full). */
  range: number;
  /** Seconds moving out (the lift, unless the rep starts with the lowering). */
  outSec: number;
  /** Seconds held at the far end. */
  holdSec: number;
  /** Seconds coming back. */
  backSec: number;
  /** Average speed going out, in ranges of motion per second. */
  speed: number;
  /** Average distance from the target path, as a share of the range of motion. */
  deviation: number;
  flags: RepFlag[];
}

export type AngleJoint = 'elbow' | 'knee' | 'hip' | 'shoulder';

export interface ExecutionResult {
  reps: RepMetrics[];
  /** 0–100: how alike the reps were in range, path and tempo. */
  score: number;
  /** Mean range of the reps, as a share of the best one. */
  rangeConsistency: number;
  /** Mean distance from the target path, as a share of the range. */
  pathDeviation: number;
  /** Speed of the last rep against the fastest (0.2 = 20% slower): fatigue within the set. */
  speedLoss: number;
  tempo: { outSec: number; holdSec: number; backSec: number };
  /** The joint that moved most, with its smallest and largest angle (degrees). */
  joint: { name: AngleJoint; side: 'left' | 'right'; min: number; max: number } | null;
  /** For drawing, in 0–1 frame coordinates. */
  drawing: {
    /** Where the handle went (decimated). */
    path: Vec[];
    /** The target path: the average way out across the reps. */
    target: Vec[];
    /** Half-width of the target zone, as a share of the frame height. */
    tolerance: number;
  };
  /** Share of frames where the handle was tracked with confidence. */
  tracked: number;
}

/** A rep under this share of the best range is cut short. */
export const SHORT_RANGE = 0.88;
/** Target zone half-width, as a share of the range of motion. */
export const PATH_TOLERANCE = 0.06;
const SAMPLES = 16;

const ANGLES: { name: AngleJoint; a: string; b: string; c: string }[] = [
  { name: 'elbow', a: 'Shoulder', b: 'Elbow', c: 'Wrist' },
  { name: 'knee', a: 'Hip', b: 'Knee', c: 'Ankle' },
  { name: 'hip', a: 'Shoulder', b: 'Hip', c: 'Knee' },
  { name: 'shoulder', a: 'Hip', b: 'Shoulder', c: 'Elbow' },
];

/** Angle at b (degrees) between b→a and b→c. */
export function angleAt(a: Vec, b: Vec, c: Vec): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (d === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / d))) * 180) / Math.PI;
}

/** The joint whose angle changes most over the clip (the one doing the exercise). */
export function mainJoint(track: Track): ExecutionResult['joint'] {
  const aspect = track.height > 0 ? track.width / track.height : 1;
  let best: ExecutionResult['joint'] = null;
  let bestRange = 15; // under 15° nothing is really bending
  for (const side of ['left', 'right'] as const) {
    const prefix = side === 'left' ? 'l' : 'r';
    for (const def of ANGLES) {
      const series: (number | null)[] = track.frames.map((f) => {
        const pts = [def.a, def.b, def.c].map((n) => f.j?.[`${prefix}${n}` as JointName]);
        if (pts.some((p) => !p || p[2] < MIN_CONFIDENCE)) return null;
        const [a, b, c] = pts.map((p) => ({ x: p![0] * aspect, y: p![1] }));
        return angleAt(a!, b!, c!);
      });
      const valid = series.filter((v): v is number => v !== null);
      if (valid.length < track.frames.length * 0.6) continue;
      const values = smooth(fillGaps(series), 5);
      const min = quantile(values, 0.03);
      const max = quantile(values, 0.97);
      if (max - min > bestRange) {
        bestRange = max - min;
        best = { name: def.name, side, min: Math.round(min), max: Math.round(max) };
      }
    }
  }
  return best;
}

/** Positions at even steps of progress (0–1 of the rep's height) on the way out or back. */
function resample(points: readonly Vec[], signal: readonly number[], from: number, to: number): Vec[] {
  const a = signal[from]!;
  const b = signal[to]!;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const out: Vec[] = [];
  for (let k = 0; k < SAMPLES; k++) {
    const q = k / (SAMPLES - 1);
    const i = crossing(signal, from, to, a + (b - a) * q);
    out.push({ x: at(xs, i), y: at(ys, i) });
  }
  return out;
}

export interface ExecutionOptions {
  /** Index of the handle among the marked points. */
  handle?: number;
  /** The rep begins with the lowering (squat, bench press) instead of the lift. */
  startsWithLowering?: boolean;
}

export function analyzeExecution(track: Track, options: ExecutionOptions = {}): ExecutionResult {
  const { points, tracked, aspect } = pointSeries(track, options.handle ?? 0);
  const t = times(track);
  const empty: ExecutionResult = {
    reps: [],
    score: 0,
    rangeConsistency: 0,
    pathDeviation: 0,
    speedLoss: 0,
    tempo: { outSec: 0, holdSec: 0, backSec: 0 },
    joint: mainJoint(track),
    drawing: { path: decimate(points, 160).map((p) => toFrame(p, aspect)), target: [], tolerance: 0 },
    tracked,
  };
  if (points.length < 8) return empty;

  // Distance travelled from the resting position, along the direction the handle moves in.
  const { axis } = principalAxis(points);
  const rest = points[0]!;
  let signal = points.map((p) => (p.x - rest.x) * axis.x + (p.y - rest.y) * axis.y);
  // Out is the first way the handle goes.
  if (Math.abs(quantile(signal, 0.02)) > Math.abs(quantile(signal, 0.98))) signal = signal.map((v) => -v);

  const spans = findReps(signal);
  if (spans.length === 0) return empty;

  const heights = spans.map((r) => signal[r.peak]! - Math.min(signal[r.start]!, signal[r.end]!));
  const bestHeight = Math.max(...heights);
  // True length of the range of motion (the path can be an arc, longer than its chord).
  const rangeLength = Math.max(1e-6, mean(spans.map((r) => pathLength(points, r.start, r.peak))));

  const ways = spans.map((r) => {
    const ph = repPhases(signal, r);
    return {
      ph,
      out: resample(points, signal, ph.leave, r.peak),
      back: resample(points, signal, r.peak, ph.back),
    };
  });
  const target = Array.from({ length: SAMPLES }, (_, k) => ({
    x: mean(ways.map((w) => w.out[k]!.x)),
    y: mean(ways.map((w) => w.out[k]!.y)),
  }));
  const targetBack = [...target].reverse();

  const lowering = options.startsWithLowering === true;
  const reps: RepMetrics[] = spans.map((r, n) => {
    const { ph, out, back } = ways[n]!;
    const outSec = t[ph.reachTop]! - t[ph.leave]!;
    const holdSec = t[ph.leaveTop]! - t[ph.reachTop]!;
    const backSec = t[ph.back]! - t[ph.leaveTop]!;
    const range = heights[n]! / bestHeight;
    const deviation =
      mean([...out.map((p, k) => dist(p, target[k]!)), ...back.map((p, k) => dist(p, targetBack[k]!))]) /
      rangeLength;
    const flags: RepFlag[] = [];
    if (range < SHORT_RANGE) flags.push('shortRange');
    if (deviation > PATH_TOLERANCE) flags.push('offPath');
    // The lowering done in under half the time of the lift is dropped, not controlled.
    const [lift, lower] = lowering ? [backSec, outSec] : [outSec, backSec];
    if (lower > 0 && lift > 0 && lower < lift * 0.5) flags.push('rushedReturn');
    return {
      range,
      outSec,
      holdSec,
      backSec,
      speed: outSec > 0 ? range / outSec : 0,
      deviation,
      flags,
    };
  });

  // Speed of the lift itself, whichever half of the rep that is.
  const liftSpeed = reps.map((r) => {
    const sec = lowering ? r.backSec : r.outSec;
    return sec > 0 ? r.range / sec : 0;
  });
  const fastest = Math.max(...liftSpeed);
  const speedLoss = fastest > 0 ? Math.max(0, 1 - liftSpeed[liftSpeed.length - 1]! / fastest) : 0;

  const rangeConsistency = mean(reps.map((r) => r.range));
  const pathDeviation = mean(reps.map((r) => r.deviation));
  const cycle = reps.map((r) => r.outSec + r.holdSec + r.backSec);
  const tempoSpread = mean(cycle) > 0 ? std(cycle) / mean(cycle) : 0;
  // Each part costs up to a third: range lost, path drift (twice the tolerance = all), tempo spread.
  const score = Math.round(
    100 *
      (1 -
        (clamp01((1 - rangeConsistency) / 0.3) +
          clamp01(pathDeviation / (PATH_TOLERANCE * 2)) +
          clamp01(tempoSpread / 0.5)) /
          3),
  );

  return {
    reps,
    score,
    rangeConsistency,
    pathDeviation,
    speedLoss,
    tempo: {
      outSec: mean(reps.map((r) => r.outSec)),
      holdSec: mean(reps.map((r) => r.holdSec)),
      backSec: mean(reps.map((r) => r.backSec)),
    },
    joint: mainJoint(track),
    drawing: {
      path: decimate(points.slice(spans[0]!.start, spans[spans.length - 1]!.end + 1), 160).map((p) =>
        toFrame(p, aspect),
      ),
      target: target.map((p) => toFrame(p, aspect)),
      tolerance: PATH_TOLERANCE * rangeLength,
    },
    tracked,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function pathLength(points: readonly Vec[], from: number, to: number): number {
  let sum = 0;
  for (let i = from + 1; i <= to; i++) sum += dist(points[i]!, points[i - 1]!);
  return sum;
}

/** At most `max` points, evenly picked (keeps the first and last). */
export function decimate<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  return Array.from({ length: max }, (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]!);
}

export type { RepSpan };
