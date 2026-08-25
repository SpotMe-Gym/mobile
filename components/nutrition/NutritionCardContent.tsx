import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { CalorieGauge } from './CalorieGauge';
import { useNutritionStore } from '../../store/nutritionStore';
import { useUserStore } from '../../store/userStore';
import { useHasHydrated } from '../../hooks/useHasHydrated';
import type { WidgetSize } from '../dashboard/widgetSizes';

interface NutritionCardContentProps {
  size?: WidgetSize;
  /** Explicit cell box from the grid or expand preview. */
  style?: StyleProp<ViewStyle>;
}

export function NutritionCardContent({ size = 'half', style }: NutritionCardContentProps) {
  const { t } = useTranslation();
  const getDailyTotals = useNutritionStore(s => s.getDailyTotals);
  const targets = useUserStore(s => s.targets);
  const isHydrated = useHasHydrated(useNutritionStore);

  const today = new Date().toISOString().split('T')[0];
  const totals = getDailyTotals(today);
  const isCompact = size === 'compact';
  const isFull = size === 'full';

  return (
    <View
      style={[
        {
          backgroundColor: '#18181b',
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#27272a',
          flex: 1,
        },
        style,
      ]}
    >
      <Card className="flex-1 w-full h-full bg-transparent border-none" title={t('dashboard.nutrition')}>
        {!isHydrated ? null : isCompact ? (
          <View className="flex-1 justify-center">
            <Text className="text-2xl font-bold text-white" numberOfLines={1}>
              {Math.round(totals.calories)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-0.5">{t('common.kcal')}</Text>
          </View>
        ) : isFull ? (
          <View className="flex-1 flex-row items-center justify-between">
            <View>
              <Text className="text-4xl font-bold text-white">{Math.round(totals.calories)}</Text>
              <Text className="text-zinc-500 text-sm">{t('common.kcal')}</Text>
            </View>
            <View className="flex-row gap-4">
              <MacroChip label={t('food.protein')} value={Math.round(totals.protein)} />
              <MacroChip label={t('food.carbs')} value={Math.round(totals.carbs)} />
              <MacroChip label={t('food.fat')} value={Math.round(totals.fat)} />
            </View>
          </View>
        ) : (
          <View className="items-center justify-center flex-1 -mt-2">
            <CalorieGauge totals={totals} size="small" targets={targets} />
          </View>
        )}
      </Card>
    </View>
  );
}

function MacroChip({ label, value }: { label: string; value: number }) {
  const { t } = useTranslation();
  return (
    <View className="items-center">
      <Text className="text-white font-bold text-lg">{value}{t('common.grams')}</Text>
      <Text className="text-zinc-500 text-xs">{label}</Text>
    </View>
  );
}
