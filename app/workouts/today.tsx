import { useCallback, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Armchair, ArrowRightLeft, Calendar, Play, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AiButton } from '@/components/AiButton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '@/components/ExpandableCardLayout';
import { TodaysPlanCardContent } from '@/components/workouts/TodaysPlanCardContent';
import { useTodaysWorkouts } from '@/hooks/useTodaysWorkouts';
import { weekdayLabel } from '@/utils/date';
import { colors } from '@/theme/colors';
import type { Exercise } from '@/store/workoutStore';

// Preview renders the same component as the home grid card so the two can never drift. Page
// width comes from the known card size — a measure-then-setState pass would re-render mid-animation.
function WorkoutCardPreview() {
  const { cardDimensions, widgetSize } = useExpandableCardContext();
  const { workouts, isHydrated } = useTodaysWorkouts();
  const { cardWidth, cardHeight } = cardDimensions;
  return (
    <View style={{ width: cardWidth, height: cardHeight }}>
      <TodaysPlanCardContent
        workouts={workouts}
        isHydrated={isHydrated}
        size={widgetSize}
        pageWidth={Math.max(cardWidth - 2, 0)}
        style={{ width: cardWidth, height: cardHeight }}
      />
    </View>
  );
}

function ExerciseRow({ ex, index }: { ex: Exercise; index: number }) {
  const { t } = useTranslation();
  const formatDuration = (seconds: number) =>
    t('workouts.durationShort', { m: Math.floor(seconds / 60), s: seconds % 60 });
  if (ex.type === 'rest') {
    return (
      <View className="mb-3 flex-row items-center rounded-xl border border-warning/30 bg-warning/10 p-3">
        <View className="mr-4 h-8 w-8 items-center justify-center rounded-full bg-warning/20">
          <Icon icon={Armchair} size={14} color={colors.warning} />
        </View>
        <View>
          <Text className="text-sm font-bold text-foreground">{t('workouts.restPeriod')}</Text>
          <Text className="text-xs text-subtle">{formatDuration(ex.restTime)}</Text>
        </View>
      </View>
    );
  }
  const phases = [
    ex.executionTime
      ? `${ex.executionName || t('workouts.executionShort')}: ${formatDuration(ex.executionTime)}`
      : null,
    ex.executionTime2
      ? `${ex.executionName2 || t('workouts.altShort')}: ${formatDuration(ex.executionTime2)}`
      : null,
    ex.restTime ? `${t('workouts.restShort')}: ${formatDuration(ex.restTime)}` : null,
  ].filter(Boolean);
  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-border bg-surface p-4">
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-surface-elevated">
        <Text className="font-bold text-subtle">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-foreground">{ex.name}</Text>
        <Text className="mt-1 text-xs text-subtle">
          {t('workouts.setsReps', { sets: ex.sets, reps: ex.reps })}
        </Text>
        {phases.length > 0 && <Text className="mt-1 text-xs text-primary-text">{phases.join(' • ')}</Text>}
      </View>
    </View>
  );
}

function WorkoutDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const { handleClose } = useExpandableCardContext();
  const { workouts, weekday, isHydrated } = useTodaysWorkouts();
  const [activeIndex, setActiveIndex] = useState(0);
  const pageWidth = windowWidth - 32;
  const dayName = weekdayLabel(weekday, i18n.language, 'long');
  const active = workouts[Math.min(activeIndex, workouts.length - 1)];

  // Index updates once per page settle — not on every scroll frame, which re-rendered the
  // whole screen at 60 Hz before.
  const onPageSettled = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth)),
    [pageWidth],
  );

  return (
    <View className="flex-1">
      <View className="items-center pb-1 pt-2">
        <View className="h-1 w-10 rounded-full bg-border-strong" />
      </View>
      <View className="px-4">
        <ScreenHeader
          title={t('dashboard.todaysPlan')}
          subtitle={dayName}
          onBack={handleClose}
          rightAction={<AiButton />}
        />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {!isHydrated ? null : active ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPageSettled}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              accessibilityRole="adjustable"
            >
              {workouts.map((workout, index) => (
                <View key={workout.id} style={{ width: pageWidth }} className="px-1">
                  <View className="h-56 justify-between overflow-hidden rounded-3xl border border-border bg-surface p-6">
                    <View className="absolute -bottom-5 -right-5 opacity-5">
                      <Icon icon={Play} size={120} />
                    </View>
                    <View>
                      <View className="flex-row items-start justify-between">
                        <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-primary-text">
                          {t('workouts.workoutOfDay', { number: index + 1, day: dayName })}
                        </Text>
                        <IconButton
                          icon={ArrowRightLeft}
                          variant="ghost"
                          iconSize={20}
                          iconColor={colors.highlight}
                          accessibilityLabel={t('workouts.changeWorkouts')}
                          onPress={() => router.push('/workouts')}
                          className="-mr-2 -mt-2"
                        />
                      </View>
                      <Text className="mb-2 text-3xl font-black text-foreground" numberOfLines={2}>
                        {workout.name}
                      </Text>
                      <View className="self-start rounded-md bg-surface-elevated px-3 py-1">
                        <Text className="text-xs font-medium text-muted">
                          {t('workouts.durationMinutes', { duration: workout.duration })}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-3">
                      {/* Live tracking isn't built yet: the control is shown, but honestly disabled. */}
                      <Button label={t('workouts.startWorkout')} disabled className="flex-1" />
                      <Badge label={t('common.comingSoon')} />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            {workouts.length > 1 && (
              <View
                className="mt-4 flex-row justify-center gap-2"
                accessibilityLabel={t('workouts.pageOf', { page: activeIndex + 1, total: workouts.length })}
              >
                {workouts.map((w, i) => (
                  <View
                    key={w.id}
                    className={`h-2 rounded-full ${i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border-strong'}`}
                  />
                ))}
              </View>
            )}

            <View className="mt-6 px-4">
              <View className="mb-4 flex-row items-center justify-between">
                <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                  {t('workouts.exercisesCount', {
                    count: active.exercises.filter((e) => e.type !== 'rest').length,
                  })}
                </Text>
                <Text className="flex-shrink text-xs font-medium text-subtle" numberOfLines={1}>
                  {active.name}
                </Text>
              </View>
              {active.exercises.map((ex, i) => (
                <ExerciseRow key={ex.id} ex={ex} index={i} />
              ))}
              <Button
                variant="outline"
                icon={<Icon icon={Plus} size={20} color={colors.subtle} />}
                label={t('workouts.addAnotherWorkout')}
                onPress={() => router.push('/workouts')}
                className="mt-6 rounded-2xl border-2 border-dashed p-4"
              />
            </View>
          </>
        ) : (
          <EmptyState
            icon={Calendar}
            title={t('workouts.restDay')}
            message={t('workouts.restDayMessage', { day: dayName })}
            action={
              <Button
                label={t('workouts.selectWorkout')}
                variant="white"
                className="px-8"
                onPress={() => router.push('/workouts')}
              />
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

export default function WorkoutDetail() {
  return (
    <ExpandableCardLayoutWithContext previewContent={<WorkoutCardPreview />}>
      <WorkoutDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
