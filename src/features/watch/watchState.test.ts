import { buildSteps, initialPlayer, goTo, pause } from '@/features/sessions/player';
import { watchStateFor, type WatchTexts } from '@/features/watch/watchState';
import type { Exercise } from '@/features/workouts/workoutStore';

const plan: Exercise[] = [
  {
    id: 'a',
    name: 'Plank',
    type: 'exercise',
    sets: 2,
    reps: '1',
    restTime: 30,
    executionTime: 40,
    executionName: 'Hold',
  },
  {
    id: 'b',
    name: 'Bench press',
    type: 'exercise',
    sets: 1,
    reps: '8',
    weight: 60,
    restTime: 0,
    executionTime: 0,
  },
];
const texts: WatchTexts = {
  phase: (s) => (s.kind === 'rest' ? 'Rest' : (s.label ?? 'Set')),
  setOf: (n, total) => `Set ${n} of ${total}`,
  target: (b) => `${b.reps} reps`,
  nextSet: (n, total) => `Next: set ${n} of ${total}`,
  nextExercise: (name) => `Next: ${name}`,
  finish: 'Last one',
  labels: { done: 'Done', pause: 'Pause', resume: 'Resume', skip: 'Skip' },
};
const steps = buildSteps(plan);
// 0 plank#0 (40) · 1 rest (30) · 2 plank#1 (40) · 3 rest before bench (30) · 4 bench#0 (reps)

describe('watch state', () => {
  it('a timed set: phase name, end time, and the set after the rest', () => {
    const s = watchStateFor(plan, steps, initialPlayer(1_000), 5_000, texts)!;
    expect(s).toMatchObject({
      exercise: 'Plank',
      set: 'Set 1 of 2',
      phase: 'Hold',
      isRest: false,
      endsAt: 41_000,
      next: 'Next: set 2 of 2',
      paused: false,
    });
  });

  it('a rest shows the set it leads into', () => {
    const s = watchStateFor(plan, steps, goTo(3, 100_000), 100_000, texts)!;
    expect(s).toMatchObject({
      exercise: 'Bench press',
      set: 'Set 1 of 1',
      phase: 'Rest',
      isRest: true,
      endsAt: 130_000,
    });
    expect(s.next).toBeUndefined();
  });

  it('the last set says it is the last; a paused timer sends the frozen time', () => {
    const last = watchStateFor(plan, steps, goTo(4, 0), 0, texts)!;
    expect(last).toMatchObject({ exercise: 'Bench press', next: 'Last one', endsAt: undefined });
    const paused = watchStateFor(plan, steps, pause(initialPlayer(0), 10_000), 99_000, texts)!;
    expect(paused).toMatchObject({ paused: true, frozen: 30, endsAt: undefined });
  });
});
