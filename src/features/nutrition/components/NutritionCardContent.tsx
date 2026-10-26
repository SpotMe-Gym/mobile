import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/shared/ui/Card';
import { CalorieGauge } from '@/features/nutrition/components/CalorieGauge';
import { useDailyTotals, useNutritionStore } from '@/features/nutrition/nutritionStore';
import { useUserStore } from '@/features/profile/userStore';
import { useHasHydrated } from '@/shared/hooks/useHasHydrated';
import { useToday } from '@/shared/hooks/useToday';
import { formatNumber } from '@/shared/utils/number';
import type { WidgetSize } from '@/features/dashboard/layout/widgetSizes';

interface NutritionCardContentProps {
  size?: WidgetSize;
  /** Explicit cell box from the grid or expand preview. */
  style?: StyleProp<ViewStyle>;
}

export function NutritionCardContent({ size = 'half', style }: NutritionCardContentProps) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const totals = useDailyTotals(today);
  const targets = useUserStore((s) => s.targets);
  const isHydrated = useHasHydrated(useNutritionStore);
  const f = (n: number) => formatNumber(n, i18n.language, 0);

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-border bg-surface" style={style}>
      <Card className="h-full w-full flex-1 bg-transparent" title={t('dashboard.nutrition')}>
        {!isHydrated ? null : size === 'compact' ? (
          <View className="flex-1 justify-center">
            <Text className="text-2xl font-bold text-foreground" numberOfLines={1}>
              {f(totals.kcal)}
            </Text>
            <Text className="mt-0.5 text-xs text-subtle">
              {t('food.ofTargetKcal', { target: f(targets.kcal) })}
            </Text>
          </View>
        ) : size === 'full' ? (
          <View className="flex-1 flex-row items-center justify-between">
            <View>
              <Text className="text-4xl font-bold text-foreground">{f(totals.kcal)}</Text>
              <Text className="text-sm text-subtle">
                {t('food.ofTargetKcal', { target: f(targets.kcal) })}
              </Text>
            </View>
            <View className="flex-row gap-4">
              <MacroChip label={t('food.protein')} value={f(totals.protein)} />
              <MacroChip label={t('food.carbs')} value={f(totals.carbs)} />
              <MacroChip label={t('food.fat')} value={f(totals.fat)} />
            </View>
          </View>
        ) : (
          <View className="-mt-2 flex-1 items-center justify-center">
            <CalorieGauge totals={totals} size="small" targets={targets} />
          </View>
        )}
      </Card>
    </View>
  );
}

function MacroChip({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  return (
    <View className="items-center">
      <Text className="text-lg font-bold text-foreground">{t('common.gramsValue', { value })}</Text>
      <Text className="text-xs text-subtle">{label}</Text>
    </View>
  );
}
