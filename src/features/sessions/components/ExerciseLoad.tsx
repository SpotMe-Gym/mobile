import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { LEVEL_COLOR } from '@/features/body/components/FatigueList';
import { muscleFatigue, musclesOf, volumeOf } from '@/features/sessions/fatigue';
import { lastPerformance, useSessionStore, type WorkoutSession } from '@/features/sessions/sessionStore';
import type { Exercise } from '@/features/workouts/workoutStore';

/**
 * The exercise's actual load in the player: kilograms moved so far (against the last time it
 * was done), and how fatigued its muscles are right now, counting the sets just logged.
 */
export function ExerciseLoad({ session, block }: { session: WorkoutSession; block: Exercise }) {
  const { t } = useTranslation();
  const { convertWeight, units } = useUnitConverter();
  const sessions = useSessionStore((s) => s.sessions);
  const done = session.sets.filter((s) => s.blockId === block.id);
  const volume = volumeOf(done);
  const previous = useMemo(
    () => volumeOf(lastPerformance(sessions, block.exerciseId, block.name, session.id)),
    [sessions, block.exerciseId, block.name, session.id],
  );
  // As of when the exercise came on screen; each set logged since then counts in full.
  const [at] = useState(() => Date.now());
  const muscles = useMemo(() => {
    const mine = musclesOf(block.exerciseId).primary;
    return muscleFatigue(sessions, at).filter((m) => mine.includes(m.muscle));
  }, [sessions, block.exerciseId, at]);

  if (volume.kg <= 0 && muscles.length === 0) return null;
  const change = previous.kg > 0 && volume.kg > 0 ? Math.round((volume.kg / previous.kg - 1) * 100) : null;
  const moved = convertWeight(volume.kg);

  return (
    <View className="mt-4 rounded-2xl border border-border bg-surface p-3">
      {volume.kg > 0 && (
        <View className="flex-row items-baseline justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-subtle">
            {t('fatigue.volume')}
          </Text>
          <Text className="text-sm text-foreground">
            <Text className="font-bold">
              {t('fatigue.volumeKg', { kg: Math.round(moved.value), unit: units.weight })}
            </Text>
            {change !== null && (
              <Text className={change >= 0 ? 'text-success-text' : 'text-warning-text'}>
                {'  '}
                {t('fatigue.vsLast', { sign: change >= 0 ? '+' : '', pct: change })}
              </Text>
            )}
          </Text>
        </View>
      )}
      {muscles.length > 0 && (
        <View className={`flex-row flex-wrap gap-x-4 gap-y-1 ${volume.kg > 0 ? 'mt-2' : ''}`}>
          {muscles.map((m) => (
            <View key={m.muscle} className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLOR[m.level] }} />
              <Text className="text-sm capitalize text-muted">
                {t('fatigue.muscleNow', {
                  muscle: t(`exercises.muscles.${m.muscle.replace(' ', '_')}` as never, {
                    defaultValue: m.muscle,
                  }),
                  level: t(`fatigue.level.${m.level}`).toLowerCase(),
                })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
