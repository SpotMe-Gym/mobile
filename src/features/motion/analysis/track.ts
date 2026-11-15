/**
 * What the native tracker returns for a video: per sampled frame, where each marked point is
 * and (optionally) the body's joints. Coordinates are 0–1 of the frame, origin top-left.
 */
import { fillGaps, smooth, type Vec } from '@/features/motion/analysis/signal';

export const JOINTS = [
  'nose',
  'neck',
  'lShoulder',
  'rShoulder',
  'lElbow',
  'rElbow',
  'lWrist',
  'rWrist',
  'lHip',
  'rHip',
  'lKnee',
  'rKnee',
  'lAnkle',
  'rAnkle',
] as const;
export type JointName = (typeof JOINTS)[number];

/** [x, y, confidence 0–1]. */
export type Sample = [number, number, number];

export interface TrackFrame {
  /** Seconds from the start of the video. */
  t: number;
  /** One per marked point, in the order they were marked; null when the tracker lost it. */
  p: (Sample | null)[];
  /** Body joints, when pose was requested and a person was found. */
  j?: Partial<Record<JointName, Sample>>;
}

export interface Track {
  /** Frame size in pixels (after rotation), for the aspect ratio. */
  width: number;
  height: number;
  duration: number;
  frames: TrackFrame[];
}

/** Below this the tracker is guessing. */
export const MIN_CONFIDENCE = 0.3;

/**
 * One marked point over time, in units of the frame's height on both axes (so distances and
 * angles are true), gaps filled and jitter smoothed. `tracked` is the share of frames where
 * the tracker was confident.
 */
export function pointSeries(track: Track, index: number, window = 5) {
  const aspect = track.height > 0 ? track.width / track.height : 1;
  const xs: (number | null)[] = [];
  const ys: (number | null)[] = [];
  let good = 0;
  for (const f of track.frames) {
    const s = f.p[index];
    if (s && s[2] >= MIN_CONFIDENCE) {
      xs.push(s[0] * aspect);
      ys.push(s[1]);
      good++;
    } else {
      xs.push(null);
      ys.push(null);
    }
  }
  const x = smooth(fillGaps(xs), window);
  const y = smooth(fillGaps(ys), window);
  const points: Vec[] = x.map((vx, i) => ({ x: vx, y: y[i]! }));
  return { points, tracked: track.frames.length ? good / track.frames.length : 0, aspect };
}

/** Back to 0–1 frame coordinates, for drawing over the picture. */
export const toFrame = (p: Vec, aspect: number): Vec => ({ x: p.x / aspect, y: p.y });

export const times = (track: Track) => track.frames.map((f) => f.t);
