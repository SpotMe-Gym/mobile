import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { FoodThumb } from '@/components/food/FoodThumb';
import { PortionEditor } from '@/components/food/PortionEditor';
import { MacroImpact } from '@/components/food/MacroImpact';
import { MealPicker } from '@/components/food/MealPicker';
import { useProduct } from '@/hooks/useFood';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useToday } from '@/hooks/useToday';
import {
  isMealType,
  useDailyTotals,
  useNutritionStore,
  type FoodRef,
  type MealType,
  type PortionUnit,
} from '@/store/nutritionStore';
import { useUserStore } from '@/store/userStore';
import { successFeedback } from '@/lib/haptics';
import {
  availableUnits,
  baseToPortion,
  defaultPortion,
  macrosForPortion,
  mealForTime,
  portionToBase,
} from '@/utils/portion';
import { ZERO_MACROS } from '@/utils/nutrition';

/**
 * Food entry sheet. Serving-first: the product's own serving size is the default unit when
 * it has one (most people think "2 biscuits", not "24 g"), with g/ml/oz one tap away.
 * Works from a deep link too — the product is fetched by barcode if it isn't cached.
 */
export default function ProductEntry() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code: string; meal?: string }>();
  const code = params.code ?? '';
  const historyItem = useNutritionStore((s) => s.foods[code]);
  const product = useProduct(code, historyItem);
  const errorMessage = useApiErrorMessage(product.error);

  const food: FoodRef | undefined = product.data ?? (historyItem?.per100 ? historyItem : undefined);
  const initialMeal: MealType = isMealType(params.meal) ? params.meal : mealForTime();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {t('food.addFood')}
        </Text>
        <IconButton
          icon={X}
          variant="ghost"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
        />
      </View>

      {food?.per100 ? (
        <EntryForm food={food} initialMeal={initialMeal} lastPortion={historyItem?.lastPortion} />
      ) : product.fetchStatus === 'fetching' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-3 text-subtle">{t('food.loadingProduct')}</Text>
        </View>
      ) : (
        <EmptyState
          icon={AlertCircle}
          tone="error"
          title={product.isError ? (errorMessage ?? t('errors.generic')) : t('food.noNutritionData')}
          message={t('food.quickAddInstead')}
          action={
            <View className="gap-3">
              {product.isError && (
                <Button label={t('common.tryAgain')} variant="secondary" onPress={() => product.refetch()} />
              )}
              <Button
                label={t('food.quickAdd')}
                variant="white"
                onPress={() =>
                  router.replace({
                    pathname: '/nutrition/quick-add',
                    params: { meal: initialMeal, name: historyItem?.name ?? '' },
                  })
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function EntryForm({
  food,
  initialMeal,
  lastPortion,
}: {
  food: FoodRef;
  initialMeal: MealType;
  lastPortion?: { quantity: number; unit: PortionUnit };
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const prefersImperial = useUserStore((s) => s.units.weight === 'lbs');
  const targets = useUserStore((s) => s.targets);
  const today = useToday();
  const todayTotals = useDailyTotals(today);
  const addEntry = useNutritionStore((s) => s.addEntry);

  const units = useMemo(() => availableUnits(food, prefersImperial), [food, prefersImperial]);
  const initial = useMemo(
    () => defaultPortion(food, prefersImperial, lastPortion),
    [food, prefersImperial, lastPortion],
  );
  const [unit, setUnit] = useState<PortionUnit>(initial.unit);
  const [quantity, setQuantity] = useState<number | null>(initial.quantity);
  const [meal, setMeal] = useState<MealType>(initialMeal);

  const portion = (quantity !== null ? macrosForPortion(food, quantity, unit) : null) ?? ZERO_MACROS;
  const canAdd = quantity !== null && quantity > 0;

  const changeUnit = (next: PortionUnit) => {
    // Keep the same amount of food when switching units (2 servings of 15 g → 30 g).
    const base = quantity !== null ? portionToBase(quantity, unit, food) : null;
    const converted = base !== null ? baseToPortion(base, next, food) : null;
    setUnit(next);
    setQuantity(converted ?? defaultPortion(food, prefersImperial, { quantity: 0, unit: next }).quantity);
  };

  const handleAdd = () => {
    if (!canAdd || quantity === null) return;
    addEntry(
      today,
      {
        meal,
        name: food.name,
        brand: food.brand,
        foodCode: food.code,
        quantity,
        unit,
        amount: portionToBase(quantity, unit, food) ?? undefined,
        macros: portion,
      },
      food,
    );
    successFeedback();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
      >
        <View className="flex-row items-center gap-4">
          <FoodThumb uri={food.imageUrl} size={64} />
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
              {food.name}
            </Text>
            {!!food.brand && (
              <Text className="text-base text-muted" numberOfLines={1}>
                {food.brand}
              </Text>
            )}
            {!!food.servingLabel && (
              <Text className="text-sm text-subtle" numberOfLines={1}>
                {t('food.servingIs', { label: food.servingLabel })}
              </Text>
            )}
          </View>
        </View>

        <PortionEditor
          food={food}
          units={units}
          unit={unit}
          quantity={quantity}
          onChangeUnit={changeUnit}
          onChangeQuantity={setQuantity}
        />

        <MacroImpact portion={portion} today={todayTotals} targets={targets} />

        <View>
          <Text className="mb-2 ml-1 font-medium text-muted">{t('food.meal')}</Text>
          <MealPicker value={meal} onChange={setMeal} />
        </View>
      </ScrollView>

      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          label={t('food.addToMeal', { meal: t(`meals.${meal}`) })}
          size="lg"
          onPress={handleAdd}
          disabled={!canAdd}
          className="w-full rounded-2xl"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
