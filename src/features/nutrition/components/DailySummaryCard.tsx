import { memo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Macros } from '@/features/nutrition/utils/nutrition';
import { Card } from '@/shared/ui/Card';
import { CalorieGauge } from '@/features/nutrition/components/CalorieGauge';
import { MacroBar } from '@/features/nutrition/components/MacroBar';

interface MacroSummaryProps {
  totals: Macros;
  targets: Macros;
  showGauge?: boolean;
}

/**
 * Daily summary card. (The former second "micronutrients" slide showed a static mock table;
 * it returns once micronutrients are actually tracked.)
 */
export const DailySummaryCard = memo(function DailySummaryCard({
  totals,
  targets,
  showGauge = true,
}: MacroSummaryProps) {
  const { t } = useTranslation();
  return (
    <View className="mb-6">
      <Card className="border border-border p-4">
        <Text accessibilityRole="header" className="mb-2 text-xl font-bold text-foreground">
          {t('food.dailySummary')}
        </Text>
        {showGauge && <CalorieGauge totals={totals} targets={targets} size="large" />}
        <View className={`flex-row gap-2 ${showGauge ? 'mb-2 mt-4' : 'mb-2 mt-2'}`}>
          <MacroBar macro="protein" value={totals.protein} target={targets.protein} />
          <MacroBar macro="carbs" value={totals.carbs} target={targets.carbs} />
          <MacroBar macro="fat" value={totals.fat} target={targets.fat} />
        </View>
      </Card>
    </View>
  );
});
