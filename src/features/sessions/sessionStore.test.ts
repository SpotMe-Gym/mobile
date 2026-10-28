import {
  estimatedOneRepMax,
  lastPerformance,
  selectActiveSession,
  summarizeSession,
  useSessionStore,
} from '@/features/sessions/sessionStore';

const workout = {
  id: 'w1',
  name: 'Push A',
  exercises: [
    {
      id: 'b1',
      exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
      name: 'Bench',
      sets: 3,
      reps: '8',
      restTime: 90,
      executionTime: 45,
      type: 'exercise' as const,
    },
  ],
};

const logBench = (sessionId: string, sets: [number, number][]) =>
  sets.forEach(([reps, weightKg], setIndex) =>
    useSessionStore.getState().logSet(sessionId, {
      blockId: 'b1',
      exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
      exerciseName: 'Bench',
      setIndex,
      reps,
      weightKg,
    }),
  );

describe('workout sessions', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('logs sets, finishes, and knows the active session', () => {
    const s = useSessionStore.getState().start(workout);
    expect(selectActiveSession(useSessionStore.getState())?.id).toBe(s.id);
    logBench(s.id, [
      [8, 60],
      [8, 60],
    ]);
    useSessionStore.getState().finish(s.id);
    expect(selectActiveSession(useSessionStore.getState())).toBeUndefined();
    expect(useSessionStore.getState().sessions[0]!.sets).toHaveLength(2);
    expect(useSessionStore.getState().sessions[0]!.plan[0]!.name).toBe('Bench');
  });

  it('remembers last time for each exercise', () => {
    const a = useSessionStore.getState().start(workout);
    logBench(a.id, [
      [8, 60],
      [7, 62.5],
    ]);
    useSessionStore.getState().finish(a.id);
    const b = useSessionStore.getState().start(workout);
    const last = lastPerformance(
      useSessionStore.getState().sessions,
      'Barbell_Bench_Press_-_Medium_Grip',
      'Bench',
      b.id,
    );
    expect(last.map((x) => [x.reps, x.weightKg])).toEqual([
      [8, 60],
      [7, 62.5],
    ]);
  });

  it('spots personal records (estimated 1RM)', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(60, 10)).toBeCloseTo(80);
    expect(estimatedOneRepMax(60, 20)).toBeNull();
    const a = useSessionStore.getState().start(workout);
    logBench(a.id, [[8, 60]]);
    useSessionStore.getState().finish(a.id);
    const b = useSessionStore.getState().start(workout);
    logBench(b.id, [
      [8, 65],
      [8, 60],
    ]);
    useSessionStore.getState().finish(b.id);
    const all = useSessionStore.getState().sessions;
    const summary = summarizeSession(all[1]!, all);
    expect(summary).toMatchObject({ sets: 2, volumeKg: 1000 });
    expect(summary.records).toEqual([{ name: 'Bench', oneRepMaxKg: 82.3 }]);
    // The first time an exercise is done isn't a "record".
    expect(summarizeSession(all[0]!, all.slice(0, 1)).records).toEqual([]);
  });
});
