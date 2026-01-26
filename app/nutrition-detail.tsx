import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useNutritionStore } from '../store/nutritionStore';
import { useUserStore } from '../store/userStore';
import { MacroCarousel } from '../components/nutrition/MacroCarousel';
import { MealList } from '../components/nutrition/MealList';
import { ScreenHeader } from '../components/ScreenHeader';
import { CalorieGauge } from '../components/nutrition/CalorieGauge';
import { Card } from '../components/ui/Card';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '../components/ExpandableCardLayout';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';

// Preview content - matches the home card appearance exactly
function NutritionCardPreview() {
  const { getDailyTotals } = useNutritionStore();
  const { targets } = useUserStore();
  const { cardDimensions } = useExpandableCardContext();
  const today = new Date().toISOString().split('T')[0];
  const nutrition = getDailyTotals(today);
  const { t } = useTranslation();

  return (
    <View className="flex-1 w-full items-center justify-center">
      <View style={{ width: cardDimensions.cardWidth, height: cardDimensions.cardHeight }}>
        <Card className="h-full bg-transparent justify-between" title={t('dashboard.nutrition')}>
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: -8 }}>
            <CalorieGauge
              totals={nutrition}
              size="small"
              targets={targets}
            />
          </View>
        </Card>
      </View>
    </View>
  );
}

// Detail content - full page with all nutrition info
function NutritionDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleClose } = useExpandableCardContext();
  const { logs, getDailyTotals } = useNutritionStore();
  const { targets } = useUserStore();

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
          title="Nutrition"
          onBack={handleClose}
          rightAction={
            <TouchableOpacity onPress={() => router.push('/chat')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Sparkles size={24} color="#3b82f6" />
            </TouchableOpacity>
          }
        />
        <Text className="text-zinc-500 text-sm -mt-5 mb-4 ml-1">{dateLabel}</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <MacroCarousel totals={totals} targets={targets} showGauge={true} />
        <MealList meals={currentLog.meals} date={today} />
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
