import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useNutritionStore } from '../../store/nutritionStore';
import { useUserStore } from '../../store/userStore';
import { MacroCarousel } from '../../components/nutrition/MacroCarousel';
import { MealList } from '../../components/nutrition/MealList';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NutritionCardContent } from '../../components/nutrition/NutritionCardContent';
import { useHasHydrated } from '../../hooks/useHasHydrated';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '../../components/ExpandableCardLayout';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';

// Preview content — renders the same component as the home grid card so the two can
// never drift apart.
function NutritionCardPreview() {
  const { cardDimensions } = useExpandableCardContext();

  return (
    <View className="flex-1 w-full items-center justify-center">
      <NutritionCardContent
        style={{ width: cardDimensions.cardWidth, height: cardDimensions.cardHeight }}
      />
    </View>
  );
}

// Detail content - full page with all nutrition info
function NutritionDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleClose } = useExpandableCardContext();
  const logs = useNutritionStore(s => s.logs);
  const getDailyTotals = useNutritionStore(s => s.getDailyTotals);
  const targets = useUserStore(s => s.targets);
  const isHydrated = useHasHydrated(useNutritionStore);
  const { t } = useTranslation();

  const today = new Date().toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const totals = getDailyTotals(today);
  const currentLog = logs[today] || {
    meals: [
      { name: 'Breakfast', foods: [] },
      { name: 'Lunch', foods: [] },
      { name: 'Dinner', foods: [] },
      { name: 'Snack', foods: [] },
    ]
  };

  return (
    <View className="flex-1">
      {/* Drag handle indicator */}
      <View className="items-center pt-2 pb-1">
        <View className="w-10 h-1 bg-zinc-600 rounded-full" />
      </View>

      <View className="px-4">
        <ScreenHeader
          title={t('dashboard.nutrition')}
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
        <Text className="text-zinc-500 text-sm -mt-5 mb-4 ml-1">{dateLabel}</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Withheld until hydrated so the screen never claims an empty day for a log
            that simply has not been read off disk yet. */}
        {isHydrated && (
          <>
            <MacroCarousel totals={totals} targets={targets} showGauge={true} />
            <MealList meals={currentLog.meals} date={today} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default function NutritionDetail() {
  return (
    <ExpandableCardLayoutWithContext
      previewContent={<NutritionCardPreview />}
      backgroundColor="#18181b"
    >
      <NutritionDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
