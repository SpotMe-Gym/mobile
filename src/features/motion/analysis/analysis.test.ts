import { analyzeExecution, angleAt } from '@/features/motion/analysis/execution';
import { analyzeMachine, classify } from '@/features/motion/analysis/machine';
import { fitMachine, referenceCurve } from '@/features/motion/analysis/movements';
import { fillGaps, findReps, smooth } from '@/features/motion/analysis/signal';
import type { Sample, Track, TrackFrame } from '@/features/motion/analysis/track';

const W = 1080;
const H = 1920;
const ASPECT = W / H;
const FPS = 15;

/** Rep progress 0→1→0 over time: rest, out, hold, back. */
function progress(t: number, rep: { rest: number; out: number; hold: number; back: number }) {
  const cycle = rep.rest + rep.out + rep.hold + rep.back;
  const u = t % cycle;
  const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;
  if (u < rep.rest) return 0;
  if (u < rep.rest + rep.out) return ease((u - rep.rest) / rep.out);
  if (u < rep.rest + rep.out + rep.hold) return 1;
  return 1 - ease((u - rep.rest - rep.out - rep.hold) / rep.back);
}

/** From positions in frame-height units to a tracker sample (0–1 of the frame). */
const sample = (x: number, y: number, jitter = 0): Sample => [
  x / ASPECT + (Math.sin(x * 9973 + y * 7919) * jitter) / ASPECT,
  y + Math.cos(x * 7919 + y * 9973) * jitter,
  0.95,
];

/** A machine whose leverage at arm angle a (0–1 of the swing) is `leverage(a)`. */
function machineTrack(leverage: (a: number) => number, reps = 3, jitter = 0.0008): Track {
  const timing = { rest: 0.6, out: 2, hold: 0.4, back: 2 };
  const cycle = timing.rest + timing.out + timing.hold + timing.back;
  const pivot = { x: 0.3, y: 0.5 };
  const radius = 0.22;
  const swing = Math.PI / 2;
  // Load height = integral of the leverage over the swing.
  const steps = 400;
  const integral = [0];
  for (let i = 1; i <= steps; i++) integral.push(integral[i - 1]! + leverage((i - 0.5) / steps) / steps);
  const rise = (a: number) => integral[Math.round(a * steps)]! * 0.12;

  const frames: TrackFrame[] = [];
  const duration = cycle * reps + 0.6;
  for (let i = 0; i < duration * FPS; i++) {
    const t = i / FPS;
    const a = t < cycle * reps ? progress(t, timing) : 0;
    const angle = Math.PI / 4 - a * swing; // from pointing down-right to up-right
    const handle = { x: pivot.x + radius * Math.cos(angle), y: pivot.y + radius * Math.sin(angle) };
    frames.push({
      t,
      p: [
        sample(handle.x, handle.y, jitter),
        sample(0.5, 0.8 - rise(a), jitter),
        sample(pivot.x, pivot.y, jitter),
      ],
    });
  }
  return { width: W, height: H, duration, frames };
}

describe('signal', () => {
  it('fills lost samples and smooths', () => {
    expect(fillGaps([null, 1, null, 3, null])).toEqual([1, 1, 2, 3, 3]);
    expect(smooth([0, 3, 0], 3)).toEqual([1.5, 1, 1.5]);
  });

  it('counts reps and ignores small wobbles', () => {
    const signal = Array.from({ length: 300 }, (_, i) => {
      const t = i / FPS;
      return progress(t, { rest: 0.5, out: 1.5, hold: 0.3, back: 1.5 }) + 0.05 * Math.sin(i * 1.7);
    });
    // 300 frames at 15 fps = 20 s, a 3.8 s cycle: five full reps.
    expect(findReps(signal)).toHaveLength(5);
    expect(findReps(signal.map(() => 0.5))).toHaveLength(0);
  });
});

describe('machine profile', () => {
  it('recovers an ascending cam', () => {
    const result = analyzeMachine(machineTrack((a) => 0.6 + 0.4 * a, 3))!;
    expect(result.reps).toBe(3);
    expect(result.shape).toBe('ascending');
    expect(result.peakAt).toBeGreaterThan(0.85);
    expect(result.thirds[0]).toBeGreaterThan(0.58);
    expect(result.thirds[0]).toBeLessThan(0.78);
    // The curve itself, away from the very ends where the slope is estimated one-sided.
    const reference = referenceCurve('ascending', result.profile.length);
    for (let k = 3; k < result.profile.length - 3; k++) {
      expect(Math.abs(result.profile[k]! - reference[k]!)).toBeLessThan(0.08);
    }
    expect(result.confidence).not.toBe('low');
  });

  it('recovers a bell-shaped cam and a constant pulley', () => {
    const bell = analyzeMachine(machineTrack((a) => 0.55 + 0.45 * Math.sin(Math.PI * a)))!;
    expect(bell.shape).toBe('bell');
    expect(bell.peakAt).toBeGreaterThan(0.3);
    expect(bell.peakAt).toBeLessThan(0.7);

    const flat = analyzeMachine(machineTrack(() => 1))!;
    expect(flat.shape).toBe('flat');
    expect(flat.lowest).toBeGreaterThan(0.85);
  });

  it('measures the arm from the pivot', () => {
    const result = analyzeMachine(
      machineTrack((a) => 1 - 0.4 * a, 2, 0),
      { pivot: 2 },
    )!;
    expect(result.shape).toBe('descending');
    expect(result.arm!.degrees).toBeGreaterThan(84);
    expect(result.arm!.degrees).toBeLessThan(92);
    expect(result.arm!.roundness).toBeGreaterThan(0.97);
    expect(
      analyzeMachine(
        machineTrack(() => 1, 2),
        { pivot: null },
      )!.arm,
    ).toBeNull();
  });

  it('needs a lift to work with', () => {
    const still: Track = {
      width: W,
      height: H,
      duration: 2,
      frames: Array.from({ length: 30 }, (_, i) => ({ t: i / FPS, p: [sample(0.3, 0.5), sample(0.5, 0.8)] })),
    };
    expect(analyzeMachine(still)).toBeNull();
  });
});

describe('machine fit', () => {
  it('names the shapes', () => {
    expect(classify(referenceCurve('ascending', 21))).toBe('ascending');
    expect(classify(referenceCurve('descending', 21))).toBe('descending');
    expect(classify(referenceCurve('bell', 21))).toBe('bell');
    expect(classify(referenceCurve('flat', 21))).toBe('flat');
  });

  it('matches a machine to the movement it suits', () => {
    const ascending = referenceCurve('ascending', 21);
    expect(fitMachine(ascending, 'chestPress').verdict).toBe('good');
    // A press that's heaviest at the bottom fights the strength curve.
    const descending = referenceCurve('descending', 21);
    const wrong = fitMachine(descending, 'chestPress');
    expect(wrong.match!).toBeLessThan(fitMachine(ascending, 'chestPress').match!);
    expect(wrong.notes).toContain('peaksEarly');
    expect(fitMachine(descending, 'row').verdict).toBe('good');
    expect(fitMachine(descending, 'row').notes).toContain('heavyWhenStretched');
  });

  it('flags a curve that fades or starts light, and has no verdict without a curve', () => {
    const fades = Array.from({ length: 21 }, (_, k) => 1 - 0.7 * (k / 20));
    expect(fitMachine(fades, 'bicepsCurl').notes).toContain('fadesAtEnd');
    const light = Array.from({ length: 21 }, (_, k) => 0.3 + 0.7 * (k / 20));
    expect(fitMachine(light, 'legExtension').notes).toContain('lightWhenStretched');
    expect(fitMachine(light, 'other')).toMatchObject({ match: null, verdict: 'unknown' });
  });
});

describe('execution', () => {
  /** A handle going straight up and down; `depth[n]` is each rep's range, `drift` its sideways error. */
  function executionTrack(depth: number[], drift: number[] = [], outSec = 1.5, backSec = 1.5): Track {
    const timing = { rest: 0.5, out: outSec, hold: 0.3, back: backSec };
    const cycle = timing.rest + timing.out + timing.hold + timing.back;
    const frames: TrackFrame[] = [];
    const duration = cycle * depth.length + 0.6;
    for (let i = 0; i < duration * FPS; i++) {
      const t = i / FPS;
      const n = Math.min(depth.length - 1, Math.floor(t / cycle));
      const a = t < cycle * depth.length ? progress(t, timing) : 0;
      const y = 0.7 - 0.3 * depth[n]! * a;
      const x = 0.3 + (drift[n] ?? 0) * Math.sin(Math.PI * a);
      // Elbow angle follows the rep: 170° at rest to 60° at the top.
      const bend = ((170 - 110 * a) * Math.PI) / 180;
      const elbow = { x: 0.2, y: 0.5 };
      frames.push({
        t,
        p: [sample(x, y, 0.0005)],
        j: {
          rShoulder: sample(elbow.x, elbow.y - 0.15),
          rElbow: sample(elbow.x, elbow.y),
          rWrist: sample(elbow.x + 0.15 * Math.sin(bend), elbow.y - 0.15 * Math.cos(bend)),
        },
      });
    }
    return { width: W, height: H, duration, frames };
  }

  it('scores an even set highly', () => {
    const result = analyzeExecution(executionTrack([1, 1, 1, 1]));
    expect(result.reps).toHaveLength(4);
    expect(result.score).toBeGreaterThan(90);
    expect(result.reps.every((r) => r.flags.length === 0)).toBe(true);
    expect(result.tempo.outSec).toBeGreaterThan(1.1);
    expect(result.tempo.outSec).toBeLessThan(1.6);
    expect(result.tempo.holdSec).toBeGreaterThan(0.2);
    expect(result.speedLoss).toBeLessThan(0.1);
    expect(result.drawing.target).toHaveLength(16);
  });

  it('flags a short rep, a rep off the path and a dropped lowering', () => {
    const short = analyzeExecution(executionTrack([1, 1, 0.7, 1]));
    expect(short.reps[2]!.flags).toContain('shortRange');
    expect(short.reps[2]!.range).toBeCloseTo(0.7, 1);
    expect(short.reps[0]!.flags).not.toContain('shortRange');

    const drifting = analyzeExecution(executionTrack([1, 1, 1, 1], [0, 0, 0, 0.12]));
    expect(drifting.reps[3]!.flags).toContain('offPath');
    expect(drifting.reps[0]!.flags).not.toContain('offPath');
    expect(drifting.score).toBeLessThan(analyzeExecution(executionTrack([1, 1, 1, 1])).score);

    const dropped = analyzeExecution(executionTrack([1, 1, 1], [], 1.6, 0.5));
    expect(dropped.reps.every((r) => r.flags.includes('rushedReturn'))).toBe(true);
    // Squat-style reps: the fast half is the lift, so nothing was dropped.
    const squat = analyzeExecution(executionTrack([1, 1, 1], [], 1.6, 0.5), { startsWithLowering: true });
    expect(squat.reps.some((r) => r.flags.includes('rushedReturn'))).toBe(false);
  });

  it('finds the joint doing the work and its angles', () => {
    expect(angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
    const result = analyzeExecution(executionTrack([1, 1, 1]));
    expect(result.joint).toMatchObject({ name: 'elbow', side: 'right' });
    expect(result.joint!.min).toBeGreaterThan(55);
    expect(result.joint!.min).toBeLessThan(70);
    expect(result.joint!.max).toBeGreaterThan(160);
  });

  it('has nothing to say about a still clip', () => {
    const still: Track = {
      width: W,
      height: H,
      duration: 2,
      frames: Array.from({ length: 30 }, (_, i) => ({ t: i / FPS, p: [sample(0.3, 0.5)] })),
    };
    expect(analyzeExecution(still).reps).toHaveLength(0);
  });
});
