/**
 * Small signal tools for tracked points: the tracker gives one position per video frame, with
 * a little jitter and the odd lost frame.
 */

export interface Vec {
  x: number;
  y: number;
}

export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const mean = (v: readonly number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);

export function median(v: readonly number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function std(v: readonly number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
}

/** The value below which `q` (0–1) of the samples fall. */
export function quantile(v: readonly number[], q: number): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const pos = Math.min(s.length - 1, Math.max(0, q * (s.length - 1)));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/** Fills lost samples by interpolating between their neighbours (ends copy the nearest). */
export function fillGaps(v: readonly (number | null)[]): number[] {
  const out = v.map((x) => (x === null || !Number.isFinite(x) ? NaN : x));
  let last = -1;
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i]!)) continue;
    if (last < 0) for (let j = 0; j < i; j++) out[j] = out[i]!;
    else if (i - last > 1) {
      for (let j = last + 1; j < i; j++) {
        out[j] = out[last]! + ((out[i]! - out[last]!) * (j - last)) / (i - last);
      }
    }
    last = i;
  }
  if (last < 0) return out.map(() => 0);
  for (let j = last + 1; j < out.length; j++) out[j] = out[last]!;
  return out;
}

/** Centred moving average; `window` is the full width in samples (odd). */
export function smooth(v: readonly number[], window: number): number[] {
  const half = Math.max(0, Math.floor(window / 2));
  if (half === 0) return [...v];
  return v.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(v.length - 1, i + half); j++) {
      sum += v[j]!;
      n++;
    }
    return sum / n;
  });
}

/** Direction of largest spread of a cloud of points (unit vector), and its centre. */
export function principalAxis(points: readonly Vec[]): { axis: Vec; centre: Vec } {
  const centre = { x: mean(points.map((p) => p.x)), y: mean(points.map((p) => p.y)) };
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { axis: { x: Math.cos(angle), y: Math.sin(angle) }, centre };
}

/** Linear interpolation of `v` at fractional index `i`. */
export function at(v: readonly number[], i: number): number {
  const lo = Math.max(0, Math.min(v.length - 1, Math.floor(i)));
  const hi = Math.min(v.length - 1, lo + 1);
  return v[lo]! + (v[hi]! - v[lo]!) * (i - lo);
}

/**
 * One repetition in a signal that goes out and comes back: indices of the start, the far
 * point, and the return.
 */
export interface RepSpan {
  start: number;
  peak: number;
  end: number;
}

/**
 * Finds repetitions in a signal that rises from rest and returns (the load going up and coming
 * down). A swing only counts when it's at least `minSwing` of the signal's whole range, so
 * jitter and small re-grips aren't reps.
 */
export function findReps(signal: readonly number[], minSwing = 0.35): RepSpan[] {
  if (signal.length < 5) return [];
  const lo = quantile(signal, 0.02);
  const hi = quantile(signal, 0.98);
  const threshold = (hi - lo) * minSwing;
  if (!(threshold > 0)) return [];

  // Zigzag: an extreme is confirmed once the signal has moved back from it by the threshold.
  const turns: { index: number; kind: 'min' | 'max' }[] = [];
  let dir: 'up' | 'down' | null = null;
  let minI = 0;
  let maxI = 0;
  for (let i = 1; i < signal.length; i++) {
    const v = signal[i]!;
    if (v > signal[maxI]!) maxI = i;
    if (v < signal[minI]!) minI = i;
    if (dir !== 'up' && v - signal[minI]! >= threshold) {
      turns.push({ index: minI, kind: 'min' });
      dir = 'up';
      maxI = i;
    } else if (dir !== 'down' && signal[maxI]! - v >= threshold) {
      if (dir === 'up') turns.push({ index: maxI, kind: 'max' });
      dir = 'down';
      minI = i;
    }
  }
  // A last return that stopped at rest without a new rep after it.
  if (dir === 'down') turns.push({ index: minI, kind: 'min' });

  const reps: RepSpan[] = [];
  for (let i = 0; i + 2 < turns.length; i++) {
    const [a, b, c] = [turns[i]!, turns[i + 1]!, turns[i + 2]!];
    if (a.kind === 'min' && b.kind === 'max' && c.kind === 'min') {
      reps.push({ start: a.index, peak: b.index, end: c.index });
    }
  }
  return reps;
}

/**
 * Where the movement really starts and stops inside a rep: the first and last samples outside
 * `edge` (a fraction of the rep's height) of the bottom and of the top. Separates moving from
 * pausing.
 */
export function repPhases(signal: readonly number[], rep: RepSpan, edge = 0.06) {
  const bottom = Math.max(signal[rep.start]!, signal[rep.end]!);
  const top = signal[rep.peak]!;
  const height = top - Math.min(signal[rep.start]!, signal[rep.end]!);
  const low = bottom + height * edge;
  const high = top - height * edge;
  let leave = rep.start;
  for (let i = rep.start; i <= rep.peak; i++) {
    if (signal[i]! <= low) leave = i;
    else break;
  }
  let reachTop = rep.peak;
  for (let i = leave; i <= rep.peak; i++) {
    if (signal[i]! >= high) {
      reachTop = i;
      break;
    }
  }
  let leaveTop = rep.peak;
  for (let i = rep.peak; i <= rep.end; i++) {
    if (signal[i]! >= high) leaveTop = i;
    else break;
  }
  let back = rep.end;
  for (let i = leaveTop; i <= rep.end; i++) {
    if (signal[i]! <= low) {
      back = i;
      break;
    }
  }
  return { leave, reachTop, leaveTop, back };
}

/**
 * The fractional index where a rising stretch of `signal` (from `from` to `to`) first reaches
 * `level`.
 */
export function crossing(signal: readonly number[], from: number, to: number, level: number): number {
  const step = to >= from ? 1 : -1;
  for (let i = from; i !== to; i += step) {
    const a = signal[i]!;
    const b = signal[i + step]!;
    if ((a <= level && b >= level) || (a >= level && b <= level)) {
      const f = b === a ? 0 : (level - a) / (b - a);
      return i + step * f;
    }
  }
  return to;
}
