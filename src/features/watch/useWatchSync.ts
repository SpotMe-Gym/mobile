import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Step } from '@/features/sessions/player';
import type { WorkoutSession } from '@/features/sessions/sessionStore';
import type { usePlayer } from '@/features/sessions/player/usePlayer';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { useHeartRateStore } from '@/features/heartRate/heartRateStore';
import { onWatchCommand, sendWatchState, startWatchWorkout } from '@/features/watch/watch';
import { watchStateFor, type WatchTexts } from '@/features/watch/watchState';

type Player = ReturnType<typeof usePlayer>;

/**
 * Keeps the SpotMe watch app in step with the player: opens it when the workout starts, sends
 * every change of step or pause, and turns its Done / pause / skip into player actions.
 */
export function useWatchSync(session: WorkoutSession | undefined, p: Player, phaseName: (s: Step) => string) {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const connected = useHeartRateStore((s) => s.watchConnected);
  const controls = useRef(p.controls);
  useEffect(() => {
    controls.current = p.controls;
  });

  // Open SpotMe on the watch (if there is one with the app, and it's turned on).
  useEffect(() => {
    if (session && !session.endedAt) void startWatchWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session
  }, [session?.id]);

  // Buttons on the watch.
  useEffect(
    () =>
      onWatchCommand((command) => {
        const c = controls.current;
        if (command === 'done') c.done();
        else if (command === 'skip') c.skip();
        else if (command === 'pause' || command === 'resume') {
          const paused = p.paused;
          if ((command === 'pause') !== paused) c.togglePause();
        }
      }),
    [p.paused],
  );

  // The step on screen, sent whenever it changes (and when the watch connects).
  const { player, steps } = p;
  useEffect(() => {
    if (!session || !connected) return;
    const texts: WatchTexts = {
      phase: phaseName,
      setOf: (n, total) => t('player.setOf', { n, total }),
      target: (block) =>
        block.weight
          ? t('player.targetWeight', {
              reps: block.reps || '–',
              weight: `${convertWeight(block.weight).formatted} ${units.weight}`,
            })
          : t('player.targetReps', { reps: block.reps || '–' }),
      nextSet: (n, total) => `${t('player.upNext')}: ${t('player.nextSet', { n, total })}`,
      nextExercise: (name) => `${t('player.upNext')}: ${name}`,
      finish: t('player.lastOne'),
      labels: {
        done: t('player.setDone'),
        pause: t('player.pause'),
        resume: t('player.resume'),
        skip: t('player.skipRest'),
      },
    };
    const state = watchStateFor(session.plan, steps, player, Date.now(), texts);
    if (state) sendWatchState(state);
    // Only when the step, pause or timing changes: not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connected,
    session?.plan,
    steps,
    player.step,
    player.startedAt,
    player.pausedAt,
    player.pausedMs,
    player.extraMs,
  ]);
}
