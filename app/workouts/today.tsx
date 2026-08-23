import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Play, Sparkles, Calendar, Plus, ArrowRightLeft, Armchair, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '../../components/ExpandableCardLayout';
import { TodaysPlanCardContent } from '../../components/workouts/TodaysPlanCardContent';
import { useTodaysWorkouts } from '../../hooks/useTodaysWorkouts';
import { useTranslation } from 'react-i18next';
import { Workout, Exercise } from '../../store/workoutStore';
import { useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

// Preview content — renders the same component as the home grid card so the two can
// never drift apart. Page width is derived from the known card dimensions rather than
// measured, since a measure-then-setState pass would re-render mid-animation.
function WorkoutCardPreview() {
  const { cardDimensions } = useExpandableCardContext();
  const { workouts, isHydrated } = useTodaysWorkouts();

  return (
    <View className="flex-1 w-full items-center justify-center">
      <TodaysPlanCardContent
        workouts={workouts}
        isHydrated={isHydrated}
        pageWidth={cardDimensions.cardWidth - 2} // minus 1px border each side
        style={{ width: cardDimensions.cardWidth, height: cardDimensions.cardHeight }}
      />
    </View>
  );
}

// Detail content
function WorkoutDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const { handleClose } = useExpandableCardContext();
  const { workouts, day: today, isHydrated } = useTodaysWorkouts();

  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);
  const width = windowWidth - 32; // Screen width minus padding
  const exerciseListRef = useRef<FlashList<Workout>>(null);

  // Sync scroll handler
  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Sync bottom list
    exerciseListRef.current?.scrollToOffset({ offset: offsetX, animated: false });

    // Update active index immediately during scroll for snappy dots
    const currentIndex = Math.round(offsetX / width);
    setActiveIndex(currentIndex);
  };

  return (
    <View className="flex-1">
      {/* Drag handle */}
      <View className="items-center pt-2 pb-1">
        <View className="w-10 h-1 bg-zinc-600 rounded-full" />
      </View>

      <View className="px-4">
        <ScreenHeader
          title={t('dashboard.todaysPlan')}
          onBack={handleClose}
          rightAction={
            <Button
              size="icon"
              variant="ai"
              icon={<Icon icon={Sparkles} size={20} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />}
              onPress={() => router.push('/chat')}
            />
          }
        />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {!isHydrated ? null : workouts.length > 0 ? (
          <>
            {/* Horizontal Carousel for Workout Cards */}
            <View className="mt-2" style={{ height: 230 }}>
              <FlashList
                data={workouts}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                estimatedItemSize={width}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / width);
                  setActiveIndex(index);
                }}
                renderItem={({ item: workout, index }) => (
                  <View style={{ width: width }} className="px-1">
                    <View className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden h-[220px] justify-between">
                      {/* Background decoration */}
                      <View className="absolute right-[-20] bottom-[-20] opacity-5">
                        <Icon icon={Play} size={120} color="white" />
                      </View>

                      <View>
                        <View className="flex-row justify-between items-start">
                          <Text className="text-blue-500 font-bold mb-1 tracking-wider text-xs">WORKOUT {index + 1} • {today.toUpperCase()}</Text>
                          <TouchableOpacity
                            onPress={() => router.push('/workouts')}
                            className="h-10 w-10 bg-orange-500 rounded-xl items-center justify-center -mt-2 -mr-2"
                            activeOpacity={0.8}
                            hitSlop={10}
                          >
                            <Icon icon={ArrowRightLeft} size={20} color='white' strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>

                        <Text className="text-3xl font-black text-white mb-2" numberOfLines={1} adjustsFontSizeToFit>{workout.name}</Text>

                        <View className="flex-row gap-4 mb-4">
                          <View className="bg-zinc-800 px-3 py-1 rounded-md"><Text className="text-zinc-300 font-medium text-xs">{workout.duration} Min</Text></View>
                          {/* Difficulty removed */}
                        </View>
                      </View>

                      <Button
                        label={t('workouts.startWorkout')}
                        variant="secondary"
                        className="w-full bg-blue-600"
                        onPress={() => console.log('Start Workout', workout.id)}
                      />
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                snapToInterval={width}
                decelerationRate="fast"
              />

              {/* Pagination Dots */}
              {workouts.length > 1 && (
                <View className="flex-row justify-center mt-4 gap-2">
                  {workouts.map((_, i) => (
                    <View
                      key={i}
                      className={`h-2 rounded-full ${i === activeIndex ? 'w-6 bg-blue-600' : 'w-2 bg-zinc-700'}`}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Exercises List - SYNCHRONIZED SCROLL */}
            <View className="mt-6">
              {/* Header for the list */}
              <View className="flex-row justify-between items-center mb-4 px-4">
                <Text className="text-white text-lg font-bold">
                  {t('workouts.exercises')} ({workouts[activeIndex]?.exercises.filter((ex: Exercise) => ex.type !== 'rest').length || 0})
                </Text>
                <Text className="text-zinc-500 text-xs font-medium">
                  {t('workouts.showing')}: {workouts[activeIndex]?.name}
                </Text>
              </View>

              <FlashList
                ref={exerciseListRef}
                data={workouts}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                estimatedItemSize={width}
                renderItem={({ item: workout }) => (
                  <View style={{ width: width }} className="px-1">
                    <View className="gap-3">
                      {workout.exercises.map((ex: Exercise, i: number) => {
                        if (ex.type === 'rest') {
                          return (
                            <View key={ex.id || i} className="bg-amber-950/20 p-3 rounded-xl border border-amber-900/30 flex-row justify-between items-center mb-3">
                              <View className="flex-row items-center gap-4">
                                <View className="h-8 w-8 bg-amber-900/20 rounded-full items-center justify-center">
                                  <Icon icon={Armchair} size={14} color="#d97706" />
                                </View>
                                <View>
                                  <Text className="text-zinc-300 font-bold text-sm">{t('workouts.restPeriod')}</Text>
                                  <Text className="text-zinc-500 text-xs">{Math.floor(ex.restTime / 60)}m {ex.restTime % 60}s</Text>
                                </View>
                              </View>
                            </View>
                          );
                        }

                        return (
                          <View key={ex.id || i} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex-row justify-between items-center mb-3">
                            <View className="flex-row items-center gap-4">
                              <View className="h-10 w-10 bg-zinc-800 rounded-full items-center justify-center">
                                <Text className="text-zinc-500 font-bold">{i + 1}</Text>
                              </View>
                              <View>
                                <Text className="text-white font-bold">{ex.name}</Text>
                                <View className="flex-row gap-2 mt-1 flex-wrap">
                                  <Text className="text-zinc-500 text-xs">{ex.sets} Sets • {ex.reps} Reps</Text>
                                  {(ex.executionTime || ex.executionTime2) && (
                                    <Text className="text-zinc-500 text-xs text-blue-400">
                                      {ex.executionTime ? `${ex.executionName || 'Exec'}: ${ex.executionTime}s` : ''}
                                      {ex.executionTime2 ? ` + ${ex.executionName2 || 'Alt'}: ${ex.executionTime2}s` : ''}
                                      {(ex.executionTime || ex.executionTime2) && ex.restTime ? ' • ' : ''}
                                      {ex.restTime ? `Rest: ${ex.restTime}s` : ''}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                snapToInterval={width}
                decelerationRate="fast"
              />

              {/* Add another workout button aligned with the end of list */}
              <Button
                variant="outline"
                icon={<Icon icon={Plus} size={20} color="#71717a" />}
                label={t('workouts.addAnotherWorkout')}
                onPress={() => router.push('/workouts')}
                className="mt-8 mx-4 border-2 border-dashed border-zinc-700 rounded-2xl p-4"
              />
            </View>
          </>
        ) : (
          <View className="items-center py-20 px-4">
            <View className="h-20 w-20 bg-zinc-900 rounded-full items-center justify-center mb-6 border border-zinc-800">
              <Calendar size={40} color="#52525b" />
            </View>
            <Text className="text-white text-2xl font-bold text-center">{t('workouts.restDay')}</Text>
            <Text className="text-zinc-500 text-center mt-2 px-10">{t('workouts.restDayMessage', { day: today })}</Text>

            <Button
              label={t('workouts.selectWorkout')}
              variant="white"
              className="mt-8 px-8"
              onPress={() => router.push('/workouts')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default function WorkoutDetail() {
  return (
    <ExpandableCardLayoutWithContext
      previewContent={<WorkoutCardPreview />}
      backgroundColor="#18181b"
    >
      <WorkoutDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
