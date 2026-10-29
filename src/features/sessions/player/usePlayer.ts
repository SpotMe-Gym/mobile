import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  addTime,
  buildSteps,
  catchUp,
  countdownCue,
  durationMs,
  elapsedMs,
  endsAt,
  goTo,
  initialPlayer,
  nextWork,
  pause,
  previousStart,
  remainingSec,
  resume,
  firstNumber,
  type PlayerState,
  type Step,
  type WorkStep,
} from '@/features/sessions/player';
import { lastPerformance, useSessionStore, type WorkoutSession } from '@/features/sessions/sessionStore';
import { cueEnd, cueTick, prepareCues } from '@/features/sessions/player/cues';
import {
  cancelTimerEnd,
  ensureTimerNotifications,
  scheduleTimerEnd,
} from '@/features/sessions/player/timerNotifications';
import { resolveExercise } from '@/features/exercises/resolve';

/** What gets logged for a set: edited in the set panel, defaulted from last time or the plan. */
export interface SetValues {
  reps: number | null;
  weightKg: number | null;
}

const TICK_MS = 200;

/** The default reps / weight for a set: what you did last time, else the plan. */
export function defaultSetValues(
  session: WorkoutSession,
  all: readonly WorkoutSession[],
  step: WorkStep,
): SetValues {
  const block = session.plan[step.blockIndex];
  if (!block) return { reps: null, weightKg: null };
  const logged = session.sets.find((s) => s.blockId === block.id && s.setIndex === step.setIndex);
  if (logged) return { reps: logged.reps, weightKg: logged.weightKg };
  const last = lastPerformance(all, block.exerciseId, block.name, session.id);
  const prev = last.find((s) => s.setIndex === step.setIndex) ?? last[last.length - 1];
  return {
    reps: prev?.reps ?? firstNumber(block.reps),
    weightKg: prev?.weightKg ?? block.weight ?? null,
  };
}

/**
 * Runs a session's player: the step list from the plan, the clock, catching up after the phone
 * was locked, logging each set when it ends, 3-2-1 cues, and a notification for a timer that
 * ends while the app is in the background.
 */
export function usePlayer(sessionId: string, opts: { sound: boolean }) {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const steps = useMemo(() => buildSteps(session?.plan ?? []), [session?.plan]);
  const [now, setNow] = useState(() => Date.now());
  const player: PlayerState = session?.player ?? initialPlayer(session ? Date.parse(session.startedAt) : now);
  const step: Step | undefined = steps[player.step];
  const finished = steps.length > 0 && player.step >= steps.length;

  // The set panel's values for the current set (kept in a ref: the clock must not re-render it).
  const valuesRef = useRef<SetValues | null>(null);
  const setValues = useCallback((v: SetValues) => {
    valuesRef.current = v;
  }, []);

  const save = useCallback(
    (next: PlayerState) => useSessionStore.getState().setPlayer(sessionId, next),
    [sessionId],
  );

  /** Logs (or updates) the set a work step completes. */
  const logStep = useCallback(
    (s: WorkStep, values: SetValues | null, durationSec: number | null) => {
      const store = useSessionStore.getState();
      const current = store.sessions.find((x) => x.id === sessionId);
      const block = current?.plan[s.blockIndex];
      if (!current || !block) return;
      const v = values ?? defaultSetValues(current, store.sessions, s);
      const existing = current.sets.find((x) => x.blockId === block.id && x.setIndex === s.setIndex);
      if (existing) {
        store.updateSet(sessionId, existing.id, { reps: v.reps, weightKg: v.weightKg });
        return;
      }
      store.logSet(sessionId, {
        blockId: block.id,
        exerciseId: block.exerciseId,
        exerciseName: resolveExercise(block.exerciseId, block.name).name,
        setIndex: s.setIndex,
        reps: v.reps,
        weightKg: v.weightKg,
        durationSec,
      });
    },
    [sessionId],
  );

  /** Seconds of execution in a set (both phases), for timed sets. */
  const setDuration = useCallback(
    (s: WorkStep) => {
      const block = session?.plan[s.blockIndex];
      if (!block || !(block.executionTime > 0)) return null;
      return block.executionTime + (block.executionTime2 ?? 0);
    },
    [session?.plan],
  );

  // First open: start the clock at the session start.
  useEffect(() => {
    if (session && !session.player) save(initialPlayer(Date.now()));
    void prepareCues();
    void ensureTimerNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session
  }, [sessionId]);

  // The clock: catch up with timers that ran out, log the sets they finished, cue.
  const prevRemaining = useRef<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      const state = useSessionStore.getState().sessions.find((x) => x.id === sessionId);
      if (!state?.player || state.endedAt) return;
      const list = buildSteps(state.plan);
      const cur = list[state.player.step];
      const rem = remainingSec(state.player, cur, t0);
      const cue = countdownCue(prevRemaining.current, rem);
      prevRemaining.current = rem;
      if (cue) cueTick(opts.sound);
      const { player: next, ended } = catchUp(state.player, list, t0);
      if (ended.length === 0) return;
      for (const i of ended) {
        const s = list[i];
        if (s?.kind === 'work' && s.endsSet) {
          logStep(s, i === state.player.step ? valuesRef.current : null, setDuration(s));
        }
      }
      if (ended.includes(state.player.step)) valuesRef.current = null;
      prevRemaining.current = null;
      cueEnd(opts.sound);
      save(next);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [sessionId, opts.sound, logStep, save, setDuration]);

  // In the background the app can't beep: a notification says when the timer is up.
  const nextLabel = useCallback(
    (i: number) => {
      const cur = steps[i];
      if (!cur) return { title: '', body: '' };
      if (cur.kind === 'rest') {
        const w = nextWork(steps, i);
        const block = w ? session?.plan[w.blockIndex] : undefined;
        return {
          title: t('player.notifyRestOver'),
          body:
            block && w ? t('player.notifySet', { n: w.setIndex + 1, total: w.sets, name: block.name }) : '',
        };
      }
      return { title: t('player.notifyWorkOver'), body: session?.plan[cur.blockIndex]?.name ?? '' };
    },
    [steps, session?.plan, t],
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const s = useSessionStore.getState().sessions.find((x) => x.id === sessionId);
      if (!s?.player || s.endedAt) return;
      if (st === 'background' || st === 'inactive') {
        const list = buildSteps(s.plan);
        const end = endsAt(s.player, list[s.player.step]);
        if (end) {
          const { title, body } = nextLabel(s.player.step);
          void scheduleTimerEnd(end, title, body);
        }
      } else if (st === 'active') {
        void cancelTimerEnd();
      }
    });
    return () => sub.remove();
  }, [sessionId, nextLabel]);

  const current = () => useSessionStore.getState().sessions.find((x) => x.id === sessionId)?.player ?? player;

  const controls = {
    /** Ends the current step now: logs the set if it completes one, and moves on. */
    done: () => {
      const p = current();
      const s = steps[p.step];
      if (s?.kind === 'work' && s.endsSet) {
        const timed = durationMs(p, s) !== null;
        logStep(s, valuesRef.current, timed ? Math.round(elapsedMs(p, Date.now()) / 1000) : setDuration(s));
      }
      valuesRef.current = null;
      prevRemaining.current = null;
      save(goTo(p.step + 1, Date.now()));
    },
    /** Moves on without logging. */
    skip: () => {
      const p = current();
      valuesRef.current = null;
      prevRemaining.current = null;
      save(goTo(Math.min(steps.length, p.step + 1), Date.now()));
    },
    back: () => {
      const p = current();
      valuesRef.current = null;
      prevRemaining.current = null;
      save(goTo(previousStart(steps, Math.min(p.step, steps.length)), Date.now()));
    },
    jump: (i: number) => {
      valuesRef.current = null;
      prevRemaining.current = null;
      save(goTo(Math.max(0, Math.min(steps.length, i)), Date.now()));
    },
    togglePause: () => {
      const p = current();
      save(p.pausedAt === null ? pause(p, Date.now()) : resume(p, Date.now()));
    },
    addSeconds: (sec: number) => save(addTime(current(), sec * 1000)),
  };

  return {
    session,
    steps,
    step,
    player,
    now,
    finished,
    paused: player.pausedAt !== null,
    remaining: remainingSec(player, step, now),
    elapsed: elapsedMs(player, now) / 1000,
    setValues,
    controls,
  };
}
