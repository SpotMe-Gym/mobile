import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/cn';
import { colors } from '@/theme/colors';
import { weekdayLabel } from '@/shared/utils/date';
import { formatNumber } from '@/shared/utils/number';
import { useWorkoutStore } from '@/features/workouts/workoutStore';
import { useSessionStore } from '@/features/sessions/sessionStore';
import { personalRecords, weekStatus } from '@/features/sessions/weekStats';
import { useTodaysWorkouts } from '@/features/workouts/hooks/useTodaysWorkouts';
import { useUnitConverter } from '@/features/profile/hooks/useUnitConverter';
import { ActionButton } from '@/features/dashboard/widgets/quickActions';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

/** This week at a glance: a dot per day, green once that day's session is done. */
function TrainingWeekRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const schedule = useWorkoutStore((s) => s.schedule);
  const sessions = useSessionStore((s) => s.sessions);
  const days = useMemo(() => weekStatus(schedule, sessions), [schedule, sessions]);
  const planned = days.reduce((n, d) => n + d.planned, 0);
  const done = days.reduce((n, d) => n + Math.min(d.done, Math.max(d.planned, d.done)), 0);
  return (
    <View className="flex-1 overflow-hidden rounded-2xl">
      <Card className="h-full w-full flex-1" title={t('dashboard.trainingWeek')}>
        <Text className="text-3xl font-bold tracking-tight text-foreground">
          {done}
          <Text className="text-base font-normal text-subtle"> / {planned}</Text>
        </Text>
        <Text className="mb-3 text-xs text-subtle">
          {planned ? t('dashboard.sessionsThisWeek') : t('dashboard.noPlanWeek')}
        </Text>
        {size !== 'compact' && (
          <View className="mt-auto flex-row justify-between">
            {days.map((d) => (
              <View key={d.weekday} className="items-center gap-1">
                <View
                  className={cn(
                    'h-7 w-7 items-center justify-center rounded-full',
                    d.done > 0
                      ? 'bg-success'
                      : d.planned > 0
                        ? 'border-2 border-primary/60'
                        : 'bg-surface-elevated',
                    d.isToday && d.done === 0 && 'border-2 border-primary',
                  )}
                >
                  {d.done > 0 && <Icon icon={Check} size={14} color={colors.background} />}
                </View>
                <Text
                  className={cn(
                    'text-[10px] font-semibold uppercase',
                    d.isToday ? 'text-primary-text' : 'text-subtle',
                  )}
                >
                  {weekdayLabel(d.weekday, i18n.language, 'narrow')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

/** Latest personal records (best estimated 1RM per exercise). */
function PersonalRecordsRender({ size }: WidgetRenderProps) {
  const { t, i18n } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const { convertWeight, units } = useUnitConverter();
  const records = useMemo(() => personalRecords(sessions, size === 'full' ? 3 : 2), [sessions, size]);
  return (
    <View className="flex-1 overflow-hidden rounded-2xl">
      <Card className="h-full w-full flex-1" title={t('dashboard.personalRecords')}>
        {records.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Icon icon={Trophy} size={22} color={colors.subtle} />
            <Text className="mt-2 text-center text-xs text-subtle">{t('dashboard.noRecords')}</Text>
          </View>
        ) : (
          records.map((r, i) => (
            <View
              key={r.name}
              className={cn(
                'flex-row items-center gap-2 py-2',
                i < records.length - 1 && 'border-b border-border',
              )}
            >
              <Icon icon={Trophy} size={14} color={colors.warning} />
              <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
                {r.name}
              </Text>
              <Text className="text-sm font-semibold text-muted">
                {t('dashboard.oneRepMax', {
                  value: formatNumber(convertWeight(r.oneRepMaxKg).value, i18n.language, 0),
                  unit: units.weight,
                })}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

/** One tap into today's first workout (or an empty session on a rest day). */
function StartWorkoutRender({ onPressIn, onPressOut }: WidgetRenderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { workouts } = useTodaysWorkouts();
  const first = workouts[0];
  return (
    <ActionButton
      label={t('dashboard.startWorkout')}
      onPress={() =>
        router.push({ pathname: '/workouts/session', params: first ? { workoutId: first.id } : {} })
      }
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  );
}

export const trainingWeekWidget: WidgetDefinition = {
  id: 'trainingWeek',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.trainingWeek',
  detailPath: '/workouts/today',
  gestureMode: 'wrapper',
  Render: TrainingWeekRender,
};

export const personalRecordsWidget: WidgetDefinition = {
  id: 'personalRecords',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.personalRecords',
  detailPath: '/workouts/today',
  gestureMode: 'wrapper',
  Render: PersonalRecordsRender,
};

export const startWorkoutAction: WidgetDefinition = {
  id: 'startWorkout',
  kind: 'action',
  category: 'training',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  titleKey: 'dashboard.startWorkout',
  gestureMode: 'inner',
  Render: StartWorkoutRender,
};
