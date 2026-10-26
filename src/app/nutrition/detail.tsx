import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { AiButton } from '@/shared/components/AiButton';
import { DailySummaryCard } from '@/features/nutrition/components/DailySummaryCard';
import { MealList } from '@/features/nutrition/components/MealList';
import { NutritionCardContent } from '@/features/nutrition/components/NutritionCardContent';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '@/shared/expandable-card/ExpandableCardLayout';
import { useDailyTotals, useDayEntries, useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useUserStore } from '@/features/profile/userStore';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { useToday } from '@/shared/hooks/useToday';
import { formatDayKey } from '@/shared/utils/date';

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
            <DailySummaryCard totals={totals} targets={targets} />
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
