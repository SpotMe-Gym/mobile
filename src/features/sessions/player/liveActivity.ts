import { useEffect, useState } from 'react';
import { LiveActivityModule, type LiveState } from '../../../../modules/spotme-live-activity';
import { nextWork, type PlayerState, type Step } from '@/features/sessions/player';
import type { usePlayer } from '@/features/sessions/player/usePlayer';
import { usePlayerTexts } from '@/features/sessions/player/usePlayerTexts';
import { useSessionStore, type WorkoutSession } from '@/features/sessions/sessionStore';
import { HR_STALE_MS, useHeartRateStore } from '@/features/heartRate/heartRateStore';
import { watchStateFor, type WatchTexts } from '@/features/watch/watchState';
import type { Exercise } from '@/features/workouts/workoutStore';

type Player = ReturnType<typeof usePlayer>;

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The player's current step as the Lock Screen and the Dynamic Island show it. For a
 * countdown it also says what comes after: iOS suspends the app while the phone is locked, so
 * the Live Activity has to switch to the next step by itself when the timer runs out.
 */
export function liveStateFor(
  plan: readonly Exercise[],
  steps: readonly Step[],
  player: PlayerState,
  now: number,
  texts: WatchTexts,
  heartRate: number | null,
): LiveState | null {
  const w = watchStateFor(plan, steps, player, now, texts);
  if (!w) return null;
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
  const state: LiveState = {
    title: w.exercise,
    subtitle: join(w.set, w.phase),
    isRest: w.isRest,
    endsAt: w.endsAt,
    startedAt: w.startedAt,
    paused: w.paused,
    pausedText: w.frozen === undefined ? undefined : clock(w.frozen),
    next: w.next,
    heartRate: heartRate ?? undefined,
  };
  if (w.endsAt !== undefined) {
    const after = steps[player.step + 1];
    if (!after) {
      state.afterTitle = texts.finish;
      state.afterSubtitle = '';
      state.afterIsRest = false;
    } else {
      const focus = after.kind === 'work' ? after : nextWork(steps, player.step + 1);
      state.afterTitle = (focus ? plan[focus.blockIndex]?.name : undefined) ?? texts.phase(after);
      state.afterSubtitle = join(
        focus ? texts.setOf(focus.setIndex + 1, focus.sets) : undefined,
        texts.phase(after),
      );
      state.afterIsRest = after.kind === 'rest';
    }
  }
  return state;
}

export function endLiveActivity() {
  void LiveActivityModule?.end().catch(() => undefined);
}

/** At launch: a Live Activity left over from a workout that's no longer running is removed. */
export function clearStaleLiveActivity() {
  if (!LiveActivityModule) return;
  if (!useSessionStore.getState().sessions.some((s) => s.endedAt === null)) endLiveActivity();
}

/**
 * Shows the workout on the Lock Screen and in the Dynamic Island while it runs, updated on
 * every change of step or pause (and the heart rate every 15 s).
 */
export function useLiveActivity(
  session: WorkoutSession | undefined,
  p: Player,
  phaseName: (s: Step) => string,
) {
  const texts = usePlayerTexts(phaseName);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  useEffect(() => {
    if (!LiveActivityModule) return;
    const read = () => {
      const hr = useHeartRateStore.getState();
      const live = hr.bpm !== null && hr.at !== null && Date.now() - hr.at < HR_STALE_MS;
      setHeartRate(live ? hr.bpm : null);
    };
    const id = setInterval(read, 15_000);
    return () => clearInterval(id);
  }, []);

  const { player, steps } = p;
  const active = session !== undefined && !session.endedAt;
  useEffect(() => {
    if (!LiveActivityModule || !session || !active) return;
    const state = liveStateFor(session.plan, steps, player, Date.now(), texts, heartRate);
    if (state) void LiveActivityModule.show(session.name, JSON.stringify(state)).catch(() => undefined);
    // Only when the step, pause, timing or heart rate changes: not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    session?.plan,
    steps,
    player.step,
    player.startedAt,
    player.pausedAt,
    player.pausedMs,
    player.extraMs,
    heartRate,
  ]);
}
