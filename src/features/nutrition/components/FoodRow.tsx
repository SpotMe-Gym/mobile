import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';
import type { FoodRef } from '@/features/nutrition/nutritionStore';
import { Icon } from '@/shared/ui/Icon';
import { FoodThumb } from '@/features/nutrition/components/FoodThumb';

interface FoodRowProps {
  food: FoodRef;
  onPress: (food: FoodRef) => void;
}

export const FoodRow = memo(function FoodRow({ food, onPress }: FoodRowProps) {
  const { t, i18n } = useTranslation();
  const f = (n: number) => formatNumber(n, i18n.language, 0);
  const per = food.servingOnly ? t('food.perServing') : t(`food.per100.${food.base}`);
  const summary = food.per100
    ? `${t('common.kcalValue', { value: f(food.per100.kcal) })} ${per}`
    : t('food.tapToLoadNutrition');

  return (
    <Pressable
      onPress={() => onPress(food)}
      accessibilityRole="button"
      accessibilityLabel={[food.name, food.brand, summary].filter(Boolean).join(', ')}
      className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-3 active:bg-surface-elevated"
    >
      <FoodThumb uri={food.imageUrl} />
      <View className="ml-3 flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {food.name}
        </Text>
        {!!food.brand && (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {food.brand}
          </Text>
        )}
        <Text className="mt-1 text-xs font-medium text-subtle">{summary}</Text>
        {food.per100 && (
          <View className="mt-1 flex-row gap-3">
            <Text className="text-xs font-semibold" style={{ color: colors.protein }}>
              {t('food.proteinShort')} {f(food.per100.protein)}
            </Text>
            <Text className="text-xs font-semibold" style={{ color: colors.carbs }}>
              {t('food.carbsShort')} {f(food.per100.carbs)}
            </Text>
            <Text className="text-xs font-semibold" style={{ color: colors.fat }}>
              {t('food.fatShort')} {f(food.per100.fat)}
            </Text>
          </View>
        )}
      </View>
      <Icon icon={ChevronRight} size={20} color={colors.subtle} />
    </Pressable>
  );
});
