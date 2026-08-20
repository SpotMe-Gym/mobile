import { View, Text, ScrollView, TouchableOpacity, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Play, Sparkles, Calendar, Plus, ArrowRightLeft, Armchair, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '../../components/ExpandableCardLayout';
import { useTranslation } from 'react-i18next';
import { useWorkoutStore, Workout, Exercise } from '../../store/workoutStore';
import { useMemo, useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to get current day name
function getCurrentDayName() {
  const d = new Date();
  return DAYS[d.getDay()];
}

// Preview content - matches the home card appearance exactly
function WorkoutCardPreview() {
  const { cardDimensions } = useExpandableCardContext();
  const { t } = useTranslation();
  const today = getCurrentDayName();
  const { schedule, workouts: allWorkouts } = useWorkoutStore();
  const [layoutWidth, setLayoutWidth] = useState(0);

  const workouts = useMemo(() => {
    const workoutIds = schedule[today] || [];
    return workoutIds.map(id => allWorkouts.find(w => w.id === id)).filter(Boolean) as Workout[];
  }, [schedule, allWorkouts, today]);

  return (
    <View className="flex-1 w-full items-center justify-center">
      <View style={{
        width: cardDimensions.cardWidth,
        height: cardDimensions.cardHeight,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#18181b',
      }}>
        <Card
          className="h-full justify-between bg-zinc-900 border border-zinc-800"
          title={t('dashboard.todaysPlan')}
        >
          {workouts.length > 0 ? (
            <View
              className="flex-1"
              onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
            >
              {(layoutWidth > 0) && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {workouts.map((workout, index) => (
                    <View key={workout.id} style={{ width: layoutWidth }} className="justify-between">
                      <View>
                        <Text className="text-white/80 font-medium text-lg mt-1" numberOfLines={1}>{workout.name}</Text>
                        <Text className="text-white/60 text-xs mt-1">{workout.duration} min • {workout.exercises.length} Ex</Text>
                      </View>
                      <Button
                        label={t('dashboard.start')}
                        variant="ghost"
                        className="bg-white/10 mt-2"
                        onPress={() => { }}
                      />
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Pagination Dots */}
              {workouts.length > 1 && (
                <View className="flex-row justify-center mt-1 gap-1 absolute bottom-0 right-0 left-0">
                  {workouts.map((_, i) => (
                    <View key={i} className="h-1 w-1 rounded-full bg-white/30" />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              <View>
                <Text className="text-white/80 font-medium text-lg mt-1">Rest Day</Text>
                <Text className="text-white/60 text-xs mt-1">No workout set</Text>
              </View>
              <Button
                label="Assign"
                variant="ghost"
                className="bg-white/10 mt-2"
                onPress={() => { }}
              />
            </>
          )}

          <View className="absolute right-[-4] bottom-[-4] opacity-5 pointer-events-none">
            {workouts.length > 0 ? <Play size={64} color="white" /> : <Calendar size={64} color="white" />}
          </View>
        </Card>
      </View>
    </View>
  );
}

// Detail content
function WorkoutDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { handleClose } = useExpandableCardContext();
  const today = getCurrentDayName();
  const { schedule, workouts: allWorkouts } = useWorkoutStore();
  const workouts = useMemo(() => {
    const workoutIds = schedule[today] || [];
    return workoutIds.map(id => allWorkouts.find(w => w.id === id)).filter(Boolean) as Workout[];
  }, [schedule, allWorkouts, today]);

  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);
  const width = windowWidth - 32; // Screen width minus padding
  const exerciseListRef = useRef<FlatList>(null);

  // Sync scroll handler
  const handleScroll = (event: any) => {
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
          title="Today's Plan"
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
        {workouts.length > 0 ? (
          <>
            {/* Horizontal Carousel for Workout Cards */}
            <View className="mt-2">
              <FlatList
                data={workouts}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                scrollEventThrottle={16}
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
                        label="Start Workout"
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
                  Exercises ({workouts[activeIndex]?.exercises.filter((ex: Exercise) => ex.type !== 'rest').length || 0})
                </Text>
                <Text className="text-zinc-500 text-xs font-medium">
                  Showing: {workouts[activeIndex]?.name}
                </Text>
              </View>

              <FlatList
                ref={exerciseListRef}
                data={workouts}
                horizontal
                pagingEnabled
                scrollEnabled={false} // Driven by top list
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
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
                                  <Text className="text-zinc-300 font-bold text-sm">Rest Period</Text>
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
                label="Add Another Workout"
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
            <Text className="text-white text-2xl font-bold text-center">Rest Day</Text>
            <Text className="text-zinc-500 text-center mt-2 px-10">No workout assigned for {today}. Enjoy your recovery or select a workout.</Text>

            <Button
              label="Select Workout"
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
