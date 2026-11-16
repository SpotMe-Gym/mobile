import { useTranslation } from 'react-i18next';
import type { Step } from '@/features/sessions/player';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import type { WatchTexts } from '@/features/watch/watchState';

/**
 * The player's words for the screens outside the app (the watch, the Live Activity), in the
 * user's language and units. A new object each render: read it when a step changes, don't
 * list it as an effect dependency.
 */
export function usePlayerTexts(phaseName: (s: Step) => string): WatchTexts {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  return {
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
}
