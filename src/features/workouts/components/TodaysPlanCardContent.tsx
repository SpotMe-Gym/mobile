import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Calendar, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { Workout } from '@/features/workouts/workoutStore';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';

interface TodaysPlanCardContentProps {
  workouts: Workout[];
  /** Width of one carousel page. Carousel is withheld until this is known. */
  pageWidth: number;
  size?: WidgetSize;
  /** Explicit cell box from the grid or expand preview. */
  style?: StyleProp<ViewStyle>;
  isHydrated?: boolean;
  onOpen?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLongPress?: () => void;
  onAction?: () => void;
  /** When true, inner controls do not fire — edit chrome owns the gestures. */
  interactionsDisabled?: boolean;
}

export function TodaysPlanCardContent({
  workouts,
  pageWidth,
  size = 'half',
  style,
  isHydrated = true,
  onOpen,
  onPressIn,
  onPressOut,
  onLongPress,
  onAction,
  interactionsDisabled = false,
}: TodaysPlanCardContentProps) {
  const { t } = useTranslation();
  const hasWorkouts = workouts.length > 0;
  const isCompact = size === 'compact';
  const first = workouts[0];
  const openHandlers = interactionsDisabled
    ? {}
    : {
        onPress: onOpen,
        onPressIn,
        onPressOut,
        onLongPress,
        delayLongPress: 400,
        accessibilityRole: 'button' as const,
        accessibilityActions: [{ name: 'longpress' as const, label: t('dashboard.editLayout') }],
        onAccessibilityAction: () => onLongPress?.(),
      };
  const meta = (w: Workout) =>
    `${t('workouts.durationMinutes', { duration: w.duration })} • ${t('workouts.exerciseCount', {
      count: w.exercises.filter((e) => e.type !== 'rest').length,
    })}`;

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface" style={style}>
      <View className="absolute left-0 right-0 top-0 z-10 px-4 pt-4" pointerEvents="none">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground" numberOfLines={1}>
          {t('dashboard.todaysPlan')}
        </Text>
      </View>

      <View className="flex-1">
        {!isHydrated ? null : isCompact ? (
          <Pressable
            className="flex-1 justify-center px-4 pt-14"
            accessibilityLabel={first ? `${first.name}, ${meta(first)}` : t('workouts.restDay')}
            {...openHandlers}
          >
            <Text className="text-base font-medium text-foreground" numberOfLines={1}>
              {first ? first.name : t('workouts.restDay')}
            </Text>
            {first && (
              <Text className="mt-1 text-xs text-muted">
                {t('workouts.durationMinutes', { duration: first.duration })}
              </Text>
            )}
          </Pressable>
        ) : hasWorkouts ? (
          <View className="flex-1">
            {pageWidth > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                scrollEnabled={!interactionsDisabled}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                {workouts.map((workout) => (
                  <View key={workout.id} style={{ width: pageWidth }} className="justify-between pb-4">
                    <Pressable
                      className="flex-1 justify-center px-4 pt-14"
                      accessibilityLabel={`${workout.name}, ${meta(workout)}`}
                      {...openHandlers}
                    >
                      <Text className="mt-1 text-lg font-medium text-foreground" numberOfLines={1}>
                        {workout.name}
                      </Text>
                      <Text className="mt-1 text-xs text-muted">{meta(workout)}</Text>
                    </Pressable>
                    <View className="px-4">
                      <Button
                        label={t('workouts.viewPlan')}
                        variant="ghost"
                        size="sm"
                        className="mt-2 bg-foreground/10"
                        textClassName="text-foreground"
                        onPress={interactionsDisabled ? undefined : onOpen}
                        disabled={interactionsDisabled}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            {workouts.length > 1 && (
              <View className="pointer-events-none absolute bottom-2 left-0 right-0 mt-1 flex-row justify-center gap-1">
                {workouts.map((w) => (
                  <View key={w.id} className="h-1 w-1 rounded-full bg-foreground/30" />
                ))}
              </View>
            )}
          </View>
        ) : (
          <Pressable
            className="flex-1 justify-between px-4 pb-4 pt-14"
            accessibilityLabel={t('workouts.restDay')}
            {...openHandlers}
          >
            <View className="flex-1 justify-center">
              <Text className="mt-1 text-lg font-medium text-foreground">{t('workouts.restDay')}</Text>
              <Text className="mt-1 text-xs text-muted">{t('workouts.noWorkoutSet')}</Text>
            </View>
            <Button
              label={t('workouts.assign')}
              variant="ghost"
              size="sm"
              className="mt-2 bg-foreground/10"
              textClassName="text-foreground"
              onPress={interactionsDisabled ? undefined : onAction}
              disabled={interactionsDisabled}
            />
          </Pressable>
        )}

        <View className="pointer-events-none absolute -bottom-1 -right-1 z-0 opacity-5">
          {!isHydrated ? null : (
            <Icon icon={hasWorkouts ? Play : Calendar} size={isCompact ? 40 : 64} color={colors.foreground} />
          )}
        </View>
      </View>
    </View>
  );
}
