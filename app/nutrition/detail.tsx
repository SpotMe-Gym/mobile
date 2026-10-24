import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AiButton } from '@/components/AiButton';
import { MacroCarousel } from '@/components/nutrition/MacroCarousel';
import { MealList } from '@/components/nutrition/MealList';
import { NutritionCardContent } from '@/components/nutrition/NutritionCardContent';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '@/components/ExpandableCardLayout';
import { useDailyTotals, useDayEntries, useNutritionStore } from '@/store/nutritionStore';
import { useUserStore } from '@/store/userStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useToday } from '@/hooks/useToday';
import { formatDayKey } from '@/utils/date';

// Preview renders the same component as the home grid card so the two can never drift.
function NutritionCardPreview() {
  const { cardDimensions, widgetSize } = useExpandableCardContext();
  const { cardWidth, cardHeight } = cardDimensions;
  return (
    <View style={{ width: cardWidth, height: cardHeight }}>
      <NutritionCardContent size={widgetSize} style={{ width: cardWidth, height: cardHeight }} />
    </View>
  );
}

function NutritionDetailContent() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { handleClose } = useExpandableCardContext();
  const today = useToday();
  const entries = useDayEntries(today);
  const totals = useDailyTotals(today);
  const targets = useUserStore((s) => s.targets);
  const isHydrated = useHasHydrated(useNutritionStore);

  return (
    <View className="flex-1">
      <View className="items-center pb-1 pt-2">
        <View className="h-1 w-10 rounded-full bg-border-strong" />
      </View>
      <View className="px-4">
        <ScreenHeader
          title={t('dashboard.nutrition')}
          subtitle={formatDayKey(today, i18n.language, { weekday: 'long', month: 'short', day: 'numeric' })}
          onBack={handleClose}
          rightAction={<AiButton />}
        />
      </View>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Withheld until hydrated so the screen never claims an empty day for a log that
            simply has not been read off disk yet. */}
        {isHydrated ? (
          <>
            <MacroCarousel totals={totals} targets={targets} />
            <MealList entries={entries} day={today} />
          </>
        ) : (
          <Text className="text-subtle">{t('common.loading')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

export default function NutritionDetail() {
  return (
    <ExpandableCardLayoutWithContext previewContent={<NutritionCardPreview />}>
      <NutritionDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}
