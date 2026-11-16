import { buildSteps, goTo, initialPlayer, pause } from '@/features/sessions/player';
import { liveStateFor } from '@/features/sessions/player/liveActivity';
import type { WatchTexts } from '@/features/watch/watchState';
import type { Exercise } from '@/features/workouts/workoutStore';

const texts: WatchTexts = {
  phase: (s) => (s.kind === 'rest' ? 'Rest' : (s.label ?? 'Work')),
  setOf: (n, total) => `Set ${n} of ${total}`,
  target: () => '10 reps',
  nextSet: (n, total) => `Next: set ${n} of ${total}`,
  nextExercise: (name) => `Next: ${name}`,
  finish: 'Last one',
  labels: { done: 'Done', pause: 'Pause', resume: 'Resume', skip: 'Skip' },
};

const plan: Exercise[] = [
  { id: 'a', name: 'Bench press', type: 'exercise', sets: 2, reps: '10', restTime: 60, executionTime: 0 },
  { id: 'b', name: 'Plank', type: 'exercise', sets: 1, reps: '1', restTime: 0, executionTime: 30 },
];
const steps = buildSteps(plan);
const T0 = 1_000_000;

describe('Live Activity state', () => {
  it('shows a reps set counting up, with what comes next', () => {
    const s = liveStateFor(plan, steps, initialPlayer(T0), T0 + 5000, texts, 128)!;
    expect(s).toMatchObject({
      title: 'Bench press',
      subtitle: 'Set 1 of 2 · Work',
      isRest: false,
      startedAt: T0,
      paused: false,
      next: 'Next: set 2 of 2',
      heartRate: 128,
    });
    expect(s.endsAt).toBeUndefined();
    // No countdown: nothing to switch to by itself.
    expect(s.afterTitle).toBeUndefined();
  });

  it('counts a rest down and says which set follows when it runs out', () => {
    const s = liveStateFor(plan, steps, goTo(1, T0), T0 + 1000, texts, null)!;
    expect(s).toMatchObject({
      title: 'Bench press',
      subtitle: 'Set 2 of 2 · Rest',
      isRest: true,
      endsAt: T0 + 60_000,
      afterTitle: 'Bench press',
      afterSubtitle: 'Set 2 of 2 · Work',
      afterIsRest: false,
    });
    expect(s.heartRate).toBeUndefined();
  });

  it('freezes the time while paused', () => {
    const s = liveStateFor(plan, steps, pause(goTo(1, T0), T0 + 18_000), T0 + 40_000, texts, null)!;
    expect(s.paused).toBe(true);
    expect(s.pausedText).toBe('0:42');
    expect(s.endsAt).toBeUndefined();
  });

  it('ends on the last timed step with the finish line', () => {
    const last = steps.length - 1;
    const s = liveStateFor(plan, steps, goTo(last, T0), T0, texts, null)!;
    expect(s.title).toBe('Plank');
    expect(s.endsAt).toBe(T0 + 30_000);
    expect(s).toMatchObject({ afterTitle: 'Last one', afterIsRest: false });
    expect(liveStateFor(plan, steps, goTo(steps.length, T0), T0, texts, null)).toBeNull();
  });
});
