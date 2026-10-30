import {
  endsAt,
  nextUp,
  nextWork,
  remainingSec,
  elapsedMs,
  type PlayerState,
  type Step,
} from '@/features/sessions/player';
import type { Exercise } from '@/features/workouts/workoutStore';

/** What the watch shows (same shape as PhoneState in targets/watch/Messages.swift). */
export interface WatchState {
  exercise: string;
  set: string;
  phase: string;
  isRest: boolean;
  target?: string;
  next?: string;
  endsAt?: number;
  startedAt: number;
  paused: boolean;
  frozen?: number;
  labels: { done: string; pause: string; resume: string; skip: string };
}

export interface WatchTexts {
  phase: (s: Step) => string;
  setOf: (n: number, total: number) => string;
  target: (block: Exercise) => string;
  nextSet: (n: number, total: number) => string;
  nextExercise: (name: string) => string;
  finish: string;
  labels: WatchState['labels'];
}

/** The player's current step as the watch shows it; null when there's nothing to show. */
export function watchStateFor(
  plan: readonly Exercise[],
  steps: readonly Step[],
  player: PlayerState,
  now: number,
  texts: WatchTexts,
): WatchState | null {
  const step = steps[player.step];
  if (!step) return null;
  // During a rest, the watch shows the set it leads into.
  const focus = step.kind === 'work' ? step : nextWork(steps, player.step);
  const block = focus ? plan[focus.blockIndex] : undefined;
  // What follows this set (past the rest): the next set, the next exercise, or the end.
  // During a rest the watch already shows the set it leads into.
  let after = step.kind === 'rest' ? null : nextUp(steps, player.step);
  if (after?.kind === 'rest') after = nextUp(steps, player.step + 1);
  if (after?.kind === 'phase') after = null;
  let next: string | undefined;
  if (after?.kind === 'finish') next = texts.finish;
  else if (after?.kind === 'set') next = texts.nextSet(after.step.setIndex + 1, after.step.sets);
  else if (after?.kind === 'exercise') next = texts.nextExercise(plan[after.step.blockIndex]?.name ?? '');
  const paused = player.pausedAt !== null;
  const remaining = remainingSec(player, step, now);
  return {
    exercise: block?.name ?? texts.phase(step),
    set: focus ? texts.setOf(focus.setIndex + 1, focus.sets) : '',
    phase: texts.phase(step),
    isRest: step.kind === 'rest',
    target: block ? texts.target(block) : undefined,
    next,
    endsAt: endsAt(player, step) ?? undefined,
    // Where the count-up of a reps set starts, pauses taken out.
    startedAt: player.startedAt + player.pausedMs,
    paused,
    frozen: paused ? (remaining ?? elapsedMs(player, now) / 1000) : undefined,
    labels: texts.labels,
  };
}
