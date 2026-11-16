import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FatigueLevel, MuscleFatigue } from '@/features/sessions/fatigue';
import type { Muscle } from '@/features/exercises/library';

export const LEVEL_COLOR: Record<FatigueLevel, string> = {
  fresh: '#22C55E',
  light: '#EAB308',
  moderate: '#F97316',
  high: '#EF4444',
};

/** Each trained muscle's fatigue: level, how long until it's fresh, and the week's hard sets. */
export function FatigueList({
  muscles,
  weekSets,
}: {
  muscles: readonly MuscleFatigue[];
  weekSets: ReadonlyMap<Muscle, { sets: number; kg: number }>;
}) {
  const { t } = useTranslation();
  const shown = muscles.filter((m) => m.fatigue >= 0.03 || weekSets.has(m.muscle));
  if (shown.length === 0) {
    return (
      <View className="rounded-2xl border border-border bg-surface p-4">
        <Text className="font-semibold text-foreground">{t('fatigue.empty')}</Text>
        <Text className="mt-1 text-sm text-muted">{t('fatigue.emptyHint')}</Text>
      </View>
    );
  }
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-surface">
      {shown.map((m, i) => {
        const name = t(`exercises.muscles.${m.muscle.replace(' ', '_')}` as never, {
          defaultValue: m.muscle,
        });
        const sets = weekSets.get(m.muscle)?.sets ?? 0;
        const level = t(`fatigue.level.${m.level}`);
        return (
          <View
            key={m.muscle}
            className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
            accessible
            accessibilityLabel={`${name}: ${level}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold capitalize text-foreground">{name}</Text>
              <Text className="text-sm font-semibold" style={{ color: LEVEL_COLOR[m.level] }}>
                {level}
              </Text>
            </View>
            <View className="mt-2 h-2 overflow-hidden rounded-full bg-surface-elevated">
              <View
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(3, Math.round(m.fatigue * 100))}%`,
                  backgroundColor: LEVEL_COLOR[m.level],
                }}
              />
            </View>
            <Text className="mt-1.5 text-xs text-subtle">
              {m.hoursToFresh > 0 ? t('fatigue.freshIn', { hours: m.hoursToFresh }) : t('fatigue.ready')}
              {sets > 0 ? ` · ${t('fatigue.weekSets', { count: Math.round(sets) })}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
