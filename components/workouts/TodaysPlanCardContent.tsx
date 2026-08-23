import { View, Text, ScrollView, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Play, Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Workout, Exercise } from '../../store/workoutStore';

interface TodaysPlanCardContentProps {
  workouts: Workout[];
  /** Width of one carousel page. Carousel is withheld until this is measured. */
  pageWidth: number;
  /** Sizing for the bordered card box (`flex: 1` on the grid, explicit dims in the preview). */
  style?: StyleProp<ViewStyle>;
  /** When false the body stays blank rather than claiming a rest day from seed state. */
  isHydrated?: boolean;
  onMeasureContent?: (width: number) => void;
  onOpen?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** Start / Assign button. */
  onAction?: () => void;
}

/**
 * Closed-card body for Today's Plan, shared by the home grid and the expandable-card
 * preview. Both must render byte-identical markup: the preview is swapped for the real
 * card the instant the collapse animation ends, so any layout difference between them
 * reads as content jumping a few pixels at the end of the transition.
 */
export function TodaysPlanCardContent({
  workouts,
  pageWidth,
  style,
  isHydrated = true,
  onMeasureContent,
  onOpen,
  onPressIn,
  onPressOut,
  onAction,
}: TodaysPlanCardContentProps) {
  const { t } = useTranslation();
  const hasWorkouts = workouts.length > 0;

  return (
    <View
      style={[
        { backgroundColor: '#18181b', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#27272a' },
        style,
      ]}
    >
      {/* Header overlay — visual only, touches pass through to the body below */}
      <View className="absolute top-0 left-0 right-0 px-4 pt-4 z-10" pointerEvents="none">
        <Text className="text-white text-lg font-bold">{t('dashboard.todaysPlan')}</Text>
      </View>

      <View
        className="flex-1"
        onLayout={onMeasureContent ? (e) => onMeasureContent(e.nativeEvent.layout.width) : undefined}
      >
        {!isHydrated ? null : hasWorkouts ? (
          <View className="flex-1">
            {pageWidth > 0 && (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                {workouts.map((workout) => (
                  <View key={workout.id} style={{ width: pageWidth }} className="justify-between pb-4">
                    <Pressable
                      className="flex-1 px-4 pt-14 justify-center"
                      onPress={onOpen}
                      onPressIn={onPressIn}
                      onPressOut={onPressOut}
                    >
                      <View>
                        <Text className="text-white/80 font-medium text-lg mt-1" numberOfLines={1}>{workout.name}</Text>
                        <Text className="text-white/60 text-xs mt-1">
                          {workout.duration} min • {workout.exercises.filter((ex: Exercise) => ex.type !== 'rest').length} Ex
                        </Text>
                      </View>
                    </Pressable>

                    <View className="px-4">
                      <Button
                        label={t('dashboard.start')}
                        variant="ghost"
                        className="bg-white/10 mt-2"
                        onPress={onAction}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {workouts.length > 1 && (
              <View className="flex-row justify-center mt-1 gap-1 absolute bottom-2 right-0 left-0 pointer-events-none">
                {workouts.map((_, i) => (
                  <View key={i} className="h-1 w-1 rounded-full bg-white/30" />
                ))}
              </View>
            )}
          </View>
        ) : (
          <Pressable
            className="flex-1 justify-between px-4 pb-4 pt-14"
            onPress={onOpen}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          >
            <View className="justify-center flex-1">
              <Text className="text-white/80 font-medium text-lg mt-1">{t('workouts.restDay')}</Text>
              <Text className="text-white/60 text-xs mt-1">{t('workouts.noWorkoutSet')}</Text>
            </View>
            <View>
              <Button
                label={t('workouts.assign')}
                variant="ghost"
                className="bg-white/10 mt-2"
                onPress={onAction}
              />
            </View>
          </Pressable>
        )}

        <View className="absolute right-[-4] bottom-[-4] opacity-5 pointer-events-none z-0">
          {!isHydrated ? null : hasWorkouts ? <Play size={64} color="white" /> : <Calendar size={64} color="white" />}
        </View>
      </View>
    </View>
  );
}
