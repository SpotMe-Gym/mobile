import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendingUp, TrendingDown, Minus, Play, Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useMemo, useState } from 'react';

import { Exercise, useWorkoutStore, Workout } from '@/store/workoutStore';
import { Calendar } from 'lucide-react-native';

import { useUserStore } from '@/store/userStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { CalorieGauge } from '@/components/nutrition/CalorieGauge';
import { useExpandableNavigation } from '@/hooks/useExpandableNavigation';
import { useUnitConverter } from '@/hooks/useUnitConverter';

import { useTranslation } from 'react-i18next';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, weightHistory, targets } = useUserStore();
  const { currentWeight, convertWeight } = useUnitConverter();
  const { getDailyTotals } = useNutritionStore();
  const { t } = useTranslation();

  const dayName = DAYS[new Date().getDay()];
  // Optimize selector to avoid infinite re-renders
  const schedule = useWorkoutStore(state => state.schedule);
  const allWorkouts = useWorkoutStore(state => state.workouts);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const todaysWorkouts = useMemo(() => {
    const workoutIds = schedule[dayName] || [];
    return workoutIds.map(id => allWorkouts.find(w => w.id === id)).filter(Boolean) as Workout[];
  }, [schedule, allWorkouts, dayName]);

  // Expandable card navigation for nutrition
  const nutritionCard = useExpandableNavigation();
  const nutritionCardScale = nutritionCard.cardScale;

  // Expandable card navigation for body weight
  const weightCard = useExpandableNavigation();
  const weightCardScale = weightCard.cardScale;

  // Expandable card navigation for workout
  const workoutCard = useExpandableNavigation();
  const workoutCardScale = workoutCard.cardScale;

  const todayDate = new Date().toISOString().split('T')[0];
  const nutrition = getDailyTotals(todayDate);

  const weightCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: weightCardScale.value }],
  }));

  const workoutCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: workoutCardScale.value }],
  }));

  const nutritionCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nutritionCardScale.value }],
  }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center relative">
          {/* Left: Profile */}
          <Pressable
            onPress={() => router.push('/profile')}
            className="h-11 w-11 bg-zinc-800 rounded-full items-center justify-center border border-zinc-700 z-10"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-white font-bold">{name ? name[0].toUpperCase() : 'U'}</Text>
          </Pressable>

          {/* Center: Title */}
          <View className="absolute left-0 right-0 items-center">
            <Text className="text-white text-xl font-black italic tracking-tighter">SPOTME</Text>
          </View>

          {/* Right: AI Chat */}
          <Button
            size="icon"
            variant="ai"
            icon={<Icon icon={Sparkles} size={20} color="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />}
            onPress={() => router.push('/chat')}
            className="z-10"
          />
        </View>

        {/* Greeting Sub-header */}
        <View className="mb-6">
          <Text className="text-textSecondary text-sm font-medium">{t('common.monday')}, {t('common.jan')} 19</Text>
          <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit>{t('common.hello')}, {name || 'User'}</Text>
        </View>

        {/* Bento Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4">

          {/* Main Stats Card (Full Width) */}
          <AnimatedPressable
            ref={weightCard.cardRef}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
            onPressIn={weightCard.handlePressIn}
            onPressOut={weightCard.handlePressOut}
            onPress={() => weightCard.navigateToDetail('/body-weight')}
            onLayout={weightCard.onLayout}
            style={weightCardAnimatedStyle}
          >
            <Animated.View style={{ flex: 1, backgroundColor: '#18181b' }}>
              <Card className="w-full bg-transparent border-none" title={t('dashboard.bodyWeight')}>
                <View className="flex-row items-baseline mt-2">
                  <Text className="text-5xl font-bold text-white">{currentWeight.formatted}</Text>
                  <Text className="text-zinc-500 text-xl ml-2">{currentWeight.unit}</Text>
                </View>
                <View className="flex-row items-center mt-4">
                  {(() => {
                    const history = weightHistory || [];
                    const latestVal = currentWeight.value;
                    const prevEntry = history.length > 1 ? history[history.length - 2] : null;
                    const prevVal = prevEntry ? convertWeight(prevEntry.weight).value : latestVal;

                    const diff = latestVal - prevVal;
                    const isGain = diff > 0;

                    if (history.length < 2 || diff === 0) {
                      return (
                        <>
                          <Minus size={16} color="#71717a" />
                          <Text className="text-zinc-500 ml-1 text-sm font-medium">{t('dashboard.noChange')}</Text>
                        </>
                      );
                    }

                    return (
                      <>
                        {isGain ? <TrendingUp size={16} color="#ef4444" /> : <TrendingDown size={16} color="#22c55e" />}
                        <Text className={`${isGain ? 'text-red-500' : 'text-green-500'} ml-1 text-sm font-medium`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)} {currentWeight.unit} {t('dashboard.sinceLast')}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              </Card>
            </Animated.View>
          </AnimatedPressable>

          {/* Active Workout (Half Width) */}
          <Animated.View
            ref={workoutCard.cardRef}
            className="w-[48%] h-44"
            onLayout={workoutCard.onLayout}
            style={workoutCardAnimatedStyle}
          >
            <Animated.View style={{ flex: 1, backgroundColor: '#18181b', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#27272a' }}>
              {/* Header Overlay - Visual only, touches pass through */}
              <View className="absolute top-0 left-0 right-0 px-4 pt-4 z-10" pointerEvents="none">
                <Text className="text-white text-lg font-bold">{t('dashboard.todaysPlan')}</Text>
              </View>

              {/* Content Area - Full Bleed */}
              <View
                className="flex-1"
                onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
              >
                {layoutWidth > 0 && (
                  todaysWorkouts.length > 0 ? (
                    <View className="flex-1">
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                      >
                        {todaysWorkouts.map((workout, index) => (
                          <View key={workout.id} style={{ width: layoutWidth }} className="justify-between pb-4">
                            <Pressable
                              className="flex-1 px-4 pt-14 justify-center"
                              onPress={() => workoutCard.navigateToDetail('/workouts/today')}
                              onPressIn={workoutCard.handlePressIn}
                              onPressOut={workoutCard.handlePressOut}
                            >
                              <View>
                                <Text className="text-white/80 font-medium text-lg mt-1" numberOfLines={1}>{workout.name}</Text>
                                <Text className="text-white/60 text-xs mt-1">{workout.duration} min • {workout.exercises.filter((ex: Exercise) => ex.type !== 'rest').length} Ex</Text>
                              </View>
                            </Pressable>

                            <View className="px-4 pointer-events-auto">
                              <Button
                                label={t('dashboard.start')}
                                variant="ghost"
                                className="bg-white/10 mt-2"
                                onPress={() => router.push('/workouts')}
                              />
                            </View>
                          </View>
                        ))}
                      </ScrollView>

                      {todaysWorkouts.length > 1 && (
                        <View className="flex-row justify-center mt-1 gap-1 absolute bottom-2 right-0 left-0 pointer-events-none">
                          {todaysWorkouts.map((_, i) => (
                            <View key={i} className="h-1 w-1 rounded-full bg-white/30" />
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <Pressable
                      className="flex-1 justify-between px-4 pb-4 pt-14"
                      onPress={() => workoutCard.navigateToDetail('/workouts/today')}
                      onPressIn={workoutCard.handlePressIn}
                      onPressOut={workoutCard.handlePressOut}
                    >
                      <View className="justify-center flex-1">
                        <Text className="text-white/80 font-medium text-lg mt-1">Rest Day</Text>
                        <Text className="text-white/60 text-xs mt-1">No workout set</Text>
                      </View>
                      <View>
                        <Button
                          label="Assign"
                          variant="ghost"
                          className="bg-white/10 mt-2"
                          onPress={() => router.push('/workouts')}
                        />
                      </View>
                    </Pressable>
                  )
                )}

                <View className="absolute right-[-4] bottom-[-4] opacity-5 pointer-events-none z-0">
                  {todaysWorkouts.length > 0 ? <Play size={64} color="white" /> : <Calendar size={64} color="white" />}
                </View>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Calories (Half Width) - Animated card that zooms into detail page */}
          <AnimatedPressable
            ref={nutritionCard.cardRef}
            className="w-[48%] h-44"
            onPressIn={nutritionCard.handlePressIn}
            onPressOut={nutritionCard.handlePressOut}
            onPress={() => nutritionCard.navigateToDetail('/nutrition/detail')}
            onLayout={nutritionCard.onLayout}
            style={nutritionCardAnimatedStyle}
          >
            <Animated.View
              style={{ flex: 1, backgroundColor: '#18181b', borderRadius: 16, overflow: 'hidden' }}
            >
              <Card className="h-full bg-transparent" title={t('dashboard.nutrition')}>
                <View className="items-center justify-center flex-1 -mt-2">
                  <CalorieGauge
                    totals={nutrition}
                    size="small"
                    targets={targets}
                  />
                </View>
              </Card>
            </Animated.View>
          </AnimatedPressable>

          {/* Quick Actions (Full Width or Row) */}
          <View className="w-full flex-row gap-3">
            <Button
              label={t('dashboard.logMeal')}
              className="flex-1 bg-zinc-800"
              variant="secondary"
              onPress={() => router.push('/nutrition/search')}
            />
            <Button
              label={t('dashboard.addWeight')}
              className="flex-1 bg-zinc-800"
              variant="secondary"
              onPress={() => router.push('/body-weight')}
            />
          </View>

          {/* Recent Activity */}
          <Card className="w-full mt-2" title={t('dashboard.recentActivity')}>
            {/* Mock Items */}
            {[1, 2, 3].map((_, i) => (
              <View key={i} className="flex-row justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                <View className="flex-row items-center">
                  <View className="h-8 w-8 rounded-full bg-zinc-800 items-center justify-center mr-3">
                    <Play size={8} color="white" />
                  </View>
                  <View>
                    <Text className="text-white font-medium">Pull Day</Text>
                    <Text className="text-zinc-500 text-xs">Yesterday</Text>
                  </View>
                </View>
                <Text className="text-zinc-400 text-sm">{t('dashboard.completed')}</Text>
              </View>
            ))}
          </Card>
        </View >

      </ScrollView >
    </SafeAreaView >
  );
}
