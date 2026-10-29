import {
  addTime,
  buildSteps,
  catchUp,
  countdownCue,
  elapsedMs,
  endsAt,
  goTo,
  initialPlayer,
  nextUp,
  nextWork,
  pause,
  previousStart,
  remainingSec,
  restAfter,
  resume,
} from '@/features/sessions/player';
import type { Exercise } from '@/features/workouts/workoutStore';

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  type: 'exercise',
  sets: 2,
  reps: '10',
  restTime: 60,
  executionTime: 0,
  ...over,
});
const rest = (id: string, restTime: number): Exercise => ({
  id,
  name: '',
  type: 'rest',
  sets: 0,
  reps: '',
  restTime,
  executionTime: 0,
});

describe('workout player', () => {
  it('lays out sets, execution phases and rests', () => {
    const steps = buildSteps([
      ex('squat', { executionTime: 40, executionName: 'Down', executionTime2: 20, executionName2: 'Hold' }),
      ex('bench'),
    ]);
    expect(
      steps.map((s) =>
        s.kind === 'work'
          ? `${s.blockId}#${s.setIndex}.${s.phase}:${s.seconds}`
          : `rest:${s.between}:${s.seconds}`,
      ),
    ).toEqual([
      'squat#0.1:40',
      'squat#0.2:20',
      'rest:sets:60',
      'squat#1.1:40',
      'squat#1.2:20',
      'rest:exercises:60',
      'bench#0.1:0',
      'rest:sets:60',
      'bench#1.1:0',
    ]);
    expect(steps[0]).toMatchObject({ label: 'Down', endsSet: false });
    expect(steps[1]).toMatchObject({ label: 'Hold', endsSet: true });
  });

  it('uses the plan rest block instead of a second rest after the last set', () => {
    const steps = buildSteps([ex('a', { sets: 1 }), rest('r', 120), ex('b', { sets: 1, restTime: 0 })]);
    expect(steps.map((s) => s.kind + ':' + s.seconds)).toEqual(['work:0', 'rest:120', 'work:0']);
  });

  it('keeps time across pauses and extra time', () => {
    const steps = buildSteps([ex('a', { executionTime: 30 })]);
    let p = initialPlayer(1_000);
    expect(remainingSec(p, steps[0], 11_000)).toBe(20);
    p = pause(p, 11_000);
    expect(remainingSec(p, steps[0], 50_000)).toBe(20); // frozen while paused
    expect(endsAt(p, steps[0])).toBeNull();
    p = resume(p, 50_000);
    expect(elapsedMs(p, 55_000)).toBe(15_000);
    p = addTime(p, 15_000);
    expect(remainingSec(p, steps[0], 55_000)).toBe(30);
  });

  it('catches up with timers that ended while the phone was locked, stopping at a reps set', () => {
    const steps = buildSteps([
      ex('plank', { sets: 2, executionTime: 30, restTime: 30 }),
      ex('row', { sets: 1, restTime: 0 }),
    ]);
    // plank#0 (30) → rest (30) → plank#1 (30) → rest before row (30) → row (reps)
    const { player, ended } = catchUp(initialPlayer(0), steps, 200_000);
    expect(ended).toEqual([0, 1, 2, 3]);
    expect(player.step).toBe(4);
    expect(player.startedAt).toBe(120_000); // started exactly when the last rest ended
    // Nothing to do mid-step
    expect(catchUp(initialPlayer(0), steps, 10_000).ended).toEqual([]);
  });

  it('tells what is next: the second phase, the next set, the next exercise or the end', () => {
    const steps = buildSteps([
      ex('a', { executionTime: 10, executionTime2: 5 }),
      ex('b', { sets: 1, restTime: 0 }),
    ]);
    expect(nextUp(steps, 0).kind).toBe('phase');
    expect(nextUp(steps, 1).kind).toBe('rest');
    expect(nextUp(steps, 2)).toMatchObject({ kind: 'set', step: { setIndex: 1 } });
    expect(nextUp(steps, 5)).toMatchObject({ kind: 'exercise', step: { blockId: 'b' } });
    expect(nextUp(steps, 6).kind).toBe('finish');
    expect(nextWork(steps, 2)).toMatchObject({ blockId: 'a', setIndex: 1, phase: 1 });
    expect(restAfter(steps, 0)).toMatchObject({ seconds: 60 });
    expect(restAfter(steps, 6)).toBeNull();
  });

  it('goes back to the start of the set, then to the set before', () => {
    const steps = buildSteps([ex('a', { executionTime: 10, executionTime2: 5 })]);
    // 0 a#0.1, 1 a#0.2, 2 rest, 3 a#1.1, 4 a#1.2
    expect(previousStart(steps, 4)).toBe(3);
    expect(previousStart(steps, 3)).toBe(2);
    expect(previousStart(steps, 2)).toBe(0);
    expect(goTo(3, 5_000)).toEqual({ step: 3, startedAt: 5_000, pausedAt: null, pausedMs: 0, extraMs: 0 });
  });

  it('cues 3-2-1 once per second', () => {
    expect(countdownCue(3.2, 2.95)).toBe(3);
    expect(countdownCue(2.95, 2.5)).toBeNull();
    expect(countdownCue(1.1, 0.9)).toBe(1);
    expect(countdownCue(null, 2)).toBeNull();
  });
});
