import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useState } from 'react';

import { useTodaysWorkouts } from '@/hooks/useTodaysWorkouts';
import { useUserStore } from '@/store/userStore';
import { TodaysPlanCardContent } from '@/components/workouts/TodaysPlanCardContent';
import { NutritionCardContent } from '@/components/nutrition/NutritionCardContent';
import { BodyWeightCardContent } from '@/components/body-weight/BodyWeightCardContent';
import { useExpandableNavigation } from '@/hooks/useExpandableNavigation';

import { useTranslation } from 'react-i18next';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const name = useUserStore(s => s.name);
  const { t } = useTranslation();

  const { workouts: todaysWorkouts, isHydrated: workoutsHydrated } = useTodaysWorkouts();
  const [layoutWidth, setLayoutWidth] = useState(0);

  // Expandable card navigation for nutrition
  const nutritionCard = useExpandableNavigation();
  const nutritionCardScale = nutritionCard.cardScale;

  // Expandable card navigation for body weight
  const weightCard = useExpandableNavigation();
  const weightCardScale = weightCard.cardScale;

  // Expandable card navigation for workout
  const workoutCard = useExpandableNavigation();
  const workoutCardScale = workoutCard.cardScale;

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
          <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit>{t('common.hello')}, {name || t('common.user')}</Text>
        </View>

        {/* Bento Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4">

          {/* Main Stats Card (Full Width) */}
          <AnimatedPressable
            ref={weightCard.cardRef}
            className="w-full"
            onPressIn={weightCard.handlePressIn}
            onPressOut={weightCard.handlePressOut}
            onPress={() => weightCard.navigateToDetail('/body-weight')}
            onLayout={weightCard.onLayout}
            style={weightCardAnimatedStyle}
          >
            <BodyWeightCardContent />
          </AnimatedPressable>

          {/* Active Workout (Half Width) — plain Animated.View wrapper, not a Pressable,
              so the horizontal carousel inside keeps ownership of swipe gestures. */}
          <Animated.View
            collapsable={false}
            ref={workoutCard.cardRef}
            className="w-[48%] h-44"
            onLayout={workoutCard.onLayout}
            style={workoutCardAnimatedStyle}
          >
            <TodaysPlanCardContent
              workouts={todaysWorkouts}
              isHydrated={workoutsHydrated}
              pageWidth={layoutWidth}
              onMeasureContent={setLayoutWidth}
              style={{ flex: 1 }}
              onOpen={() => workoutCard.navigateToDetail('/workouts/today')}
              onPressIn={workoutCard.handlePressIn}
              onPressOut={workoutCard.handlePressOut}
              onAction={() => router.push('/workouts')}
            />
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
            <NutritionCardContent style={{ flex: 1 }} />
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
                    <Text className="text-white font-medium">{t('dashboard.pullDay')}</Text>
                    <Text className="text-zinc-500 text-xs">{t('dashboard.yesterday')}</Text>
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
