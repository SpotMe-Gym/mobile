/**
 * The workout player: turns a workout plan into the sequence you actually go through, and keeps
 * time with wall-clock timestamps, so it stays right when the phone is locked or the app is
 * killed and reopened.
 *
 *   exercise block, for each set:  work (execution phase) → work (second phase, if set) → rest
 *   rest block:                    rest
 *
 * A work step with no execution time is a reps set: no countdown, the clock counts up and the
 * set ends when you tap Done. Timed steps end by themselves and the player moves on.
 */
import type { Exercise } from '@/features/workouts/workoutStore';

export interface WorkStep {
  kind: 'work';
  blockId: string;
  blockIndex: number;
  setIndex: number;
  sets: number;
  /** 1 = execution, 2 = second phase. */
  phase: 1 | 2;
  /** 0 = reps set (counts up until Done). */
  seconds: number;
  /** The phase name from the workout (e.g. "Eccentric", "Hold"), if any. */
  label?: string;
  /** True on the step that completes the set (where the set is logged). */
  endsSet: boolean;
}

export interface RestStep {
  kind: 'rest';
  blockId: string;
  blockIndex: number;
  /** The set it follows (-1 for a rest block). */
  setIndex: number;
  seconds: number;
  /** Between two sets of the same exercise, before the next exercise, or a rest block. */
  between: 'sets' | 'exercises' | 'block';
}

export type Step = WorkStep | RestStep;

export function buildSteps(plan: readonly Exercise[]): Step[] {
  const steps: Step[] = [];
  plan.forEach((block, blockIndex) => {
    if (block.type === 'rest') {
      if (block.restTime > 0) {
        steps.push({
          kind: 'rest',
          blockId: block.id,
          blockIndex,
          setIndex: -1,
          seconds: block.restTime,
          between: 'block',
        });
      }
      return;
    }
    const sets = Math.max(1, block.sets || 1);
    const second = (block.executionTime2 ?? 0) > 0;
    for (let s = 0; s < sets; s++) {
      steps.push({
        kind: 'work',
        blockId: block.id,
        blockIndex,
        setIndex: s,
        sets,
        phase: 1,
        seconds: Math.max(0, block.executionTime || 0),
        label: block.executionName || undefined,
        endsSet: !second,
      });
      if (second) {
        steps.push({
          kind: 'work',
          blockId: block.id,
          blockIndex,
          setIndex: s,
          sets,
          phase: 2,
          seconds: block.executionTime2 ?? 0,
          label: block.executionName2 || undefined,
          endsSet: true,
        });
      }
      const last = s === sets - 1;
      const nextBlock = plan[blockIndex + 1];
      // After the last set: rest before the next exercise, unless the plan has its own rest
      // block there, or the workout is over.
      const restHere = block.restTime > 0 && (!last || (nextBlock && nextBlock.type !== 'rest'));
      if (restHere) {
        steps.push({
          kind: 'rest',
          blockId: block.id,
          blockIndex,
          setIndex: s,
          seconds: block.restTime,
          between: last ? 'exercises' : 'sets',
        });
      }
    }
  });
  return steps;
}

/** Where the player is. Stored with the session (on this device only). */
export interface PlayerState {
  step: number;
  /** When the current step started (ms). */
  startedAt: number;
  /** Set while paused (ms). */
  pausedAt: number | null;
  /** Time spent paused during this step (ms). */
  pausedMs: number;
  /** Time added to this step's countdown (+15 s). */
  extraMs: number;
}

export const initialPlayer = (now: number): PlayerState => ({
  step: 0,
  startedAt: now,
  pausedAt: null,
  pausedMs: 0,
  extraMs: 0,
});

/** Milliseconds into the current step, not counting pauses. */
export function elapsedMs(p: PlayerState, now: number): number {
  const until = p.pausedAt ?? now;
  return Math.max(0, until - p.startedAt - p.pausedMs);
}

/** Total length of a timed step (ms), or null for a reps set. */
export function durationMs(p: PlayerState, step: Step | undefined): number | null {
  if (!step || step.seconds <= 0) return null;
  return step.seconds * 1000 + p.extraMs;
}

/** Seconds left on a timed step (null for a reps set). */
export function remainingSec(p: PlayerState, step: Step | undefined, now: number): number | null {
  const total = durationMs(p, step);
  return total === null ? null : Math.max(0, (total - elapsedMs(p, now)) / 1000);
}

/** When the current timed step ends (ms), null if it doesn't end by itself or is paused. */
export function endsAt(p: PlayerState, step: Step | undefined): number | null {
  const total = durationMs(p, step);
  if (total === null || p.pausedAt !== null) return null;
  return p.startedAt + p.pausedMs + total;
}

export const goTo = (step: number, at: number): PlayerState => ({ ...initialPlayer(at), step });

export const pause = (p: PlayerState, now: number): PlayerState =>
  p.pausedAt === null ? { ...p, pausedAt: now } : p;

export const resume = (p: PlayerState, now: number): PlayerState =>
  p.pausedAt === null ? p : { ...p, pausedAt: null, pausedMs: p.pausedMs + (now - p.pausedAt) };

export const addTime = (p: PlayerState, ms: number): PlayerState => ({ ...p, extraMs: p.extraMs + ms });

/**
 * Moves past every timed step that has run out, each next step starting exactly when the one
 * before ended (so a rest that ended while the phone was locked doesn't eat into the set).
 * Stops at a reps set, which waits for Done. Returns the steps that ended (to log sets).
 */
export function catchUp(
  p: PlayerState,
  steps: readonly Step[],
  now: number,
): { player: PlayerState; ended: number[] } {
  let player = p;
  const ended: number[] = [];
  for (let guard = 0; guard < steps.length; guard++) {
    const end = endsAt(player, steps[player.step]);
    if (end === null || end > now || player.step >= steps.length) break;
    ended.push(player.step);
    player = goTo(player.step + 1, end);
  }
  return { player, ended };
}

/** First step of the set or block before / after the current one (for ‹ and › buttons). */
export function previousStart(steps: readonly Step[], i: number): number {
  const cur = steps[i];
  if (!cur) return Math.max(0, steps.length - 1);
  // Start of the current set (or rest) …
  let start = i;
  while (start > 0 && sameUnit(steps[start - 1]!, cur)) start--;
  if (start < i) return start;
  // … or, already there, start of the one before.
  const prev = steps[i - 1];
  if (!prev) return 0;
  let j = i - 1;
  while (j > 0 && sameUnit(steps[j - 1]!, prev)) j--;
  return j;
}

const sameUnit = (a: Step, b: Step) =>
  a.kind === b.kind && a.blockIndex === b.blockIndex && a.setIndex === b.setIndex;

/** What comes after the current step, for the "next up" card. */
export type NextUp =
  | { kind: 'phase'; step: WorkStep }
  | { kind: 'rest'; step: RestStep }
  | { kind: 'set'; step: WorkStep }
  | { kind: 'exercise'; step: WorkStep }
  | { kind: 'finish' };

export function nextUp(steps: readonly Step[], i: number): NextUp {
  const cur = steps[i];
  const next = steps[i + 1];
  if (!next) return { kind: 'finish' };
  if (next.kind === 'rest') return { kind: 'rest', step: next };
  // The next work step: same set (second phase), same exercise (next set) or a new exercise.
  if (cur && cur.kind === 'work' && next.blockIndex === cur.blockIndex && next.setIndex === cur.setIndex) {
    return { kind: 'phase', step: next };
  }
  if (cur && next.blockIndex === cur.blockIndex) return { kind: 'set', step: next };
  return { kind: 'exercise', step: next };
}

/** The next work step after `i` (what a rest leads into). */
export function nextWork(steps: readonly Step[], i: number): WorkStep | null {
  for (let j = i + 1; j < steps.length; j++) {
    const s = steps[j]!;
    if (s.kind === 'work') return s;
  }
  return null;
}

/** Rest that follows the current set (what to show as the second timer while working). */
export function restAfter(steps: readonly Step[], i: number): RestStep | null {
  for (let j = i + 1; j < steps.length; j++) {
    const s = steps[j]!;
    if (s.kind === 'rest') return s;
    if (s.kind === 'work' && s.phase === 1) return null;
  }
  return null;
}

/** "8-12" → 8, "AMRAP" → null. */
export const firstNumber = (reps: string) => {
  const m = /\d+/.exec(reps);
  return m ? Number(m[0]) : null;
};

/** 3-2-1 cue seconds for a countdown: which whole second just started (3, 2, 1) or null. */
export function countdownCue(prevRemaining: number | null, remaining: number | null): 3 | 2 | 1 | null {
  if (prevRemaining === null || remaining === null) return null;
  for (const s of [3, 2, 1] as const) {
    if (prevRemaining > s && remaining <= s && remaining > s - 1) return s;
  }
  return null;
}
