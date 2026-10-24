import { memo, useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AiButton } from '@/components/AiButton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { scheduledDays, useWorkoutStore, type Workout } from '@/store/workoutStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { weekdayLabel } from '@/utils/date';
import { colors } from '@/theme/colors';

const WorkoutItem = memo(function WorkoutItem({
  item,
  days,
  onPress,
}: {
  item: Workout;
  days: string;
  onPress: (id: string) => void;
}) {
  const { t } = useTranslation();
  const exerciseCount = item.exercises.filter((e) => e.type !== 'rest').length;
  const meta = `${t('workouts.exerciseCount', { count: exerciseCount })} • ${t('workouts.durationMinutes', { duration: item.duration })}`;
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={[item.name, meta, days].filter(Boolean).join(', ')}
      accessibilityHint={t('workouts.editHint')}
      className="mb-4 flex-row items-center rounded-2xl border border-border bg-surface p-4 active:bg-surface-elevated"
    >
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
        <Icon icon={Dumbbell} size={24} color={colors.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-foreground">{item.name}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-subtle">{meta}</Text>
          {!!days && (
            <View className="rounded bg-primary/20 px-2 py-0.5">
              <Text className="text-xs font-medium capitalize text-primary-text">{days}</Text>
            </View>
          )}
        </View>
      </View>
      <Icon icon={ChevronRight} size={20} color={colors.subtle} />
    </Pressable>
  );
});

export default function Workouts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const workouts = useWorkoutStore((s) => s.workouts);
  const schedule = useWorkoutStore((s) => s.schedule);
  const addSamplePlan = useWorkoutStore((s) => s.addSamplePlan);
  const isHydrated = useHasHydrated(useWorkoutStore);

  // Precomputed once per schedule change instead of per row per render.
  const daysById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workouts) {
      map.set(
        w.id,
        scheduledDays(schedule, w.id)
          .map((d) => weekdayLabel(d, i18n.language, 'short'))
          .join(', '),
      );
    }
    return map;
  }, [workouts, schedule, i18n.language]);

  const openWorkout = useCallback(
    (id: string) => router.push({ pathname: '/workouts/create', params: { id } }),
    [router],
  );
  const renderItem = useCallback(
    ({ item }: { item: Workout }) => (
      <WorkoutItem item={item} days={daysById.get(item.id) ?? ''} onPress={openWorkout} />
    ),
    [daysById, openWorkout],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4">
        <ScreenHeader title={t('workouts.myWorkouts')} className="mt-4" rightAction={<AiButton />} />
        {isHydrated && (
          <FlashList
            data={workouts}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            ListEmptyComponent={
              <EmptyState
                icon={Dumbbell}
                title={t('workouts.noWorkoutsYet')}
                message={t('workouts.createFirstWorkout')}
                action={
                  <View className="gap-3">
                    <Button
                      label={t('workouts.newWorkout')}
                      variant="white"
                      onPress={() => router.push('/workouts/create')}
                    />
                    <Button label={t('workouts.addSamplePlan')} variant="ghost" onPress={addSamplePlan} />
                  </View>
                }
              />
            }
          />
        )}
        <IconButton
          icon={Plus}
          variant="primary"
          iconSize={28}
          accessibilityLabel={t('workouts.newWorkout')}
          onPress={() => router.push('/workouts/create')}
          className="absolute right-6 h-14 w-14 shadow-lg"
          style={{ bottom: insets.bottom + 16 }}
        />
      </View>
    </SafeAreaView>
  );
}
