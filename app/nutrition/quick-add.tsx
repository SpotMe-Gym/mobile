import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { NumberField } from '@/components/ui/NumberField';
import { MealPicker } from '@/components/food/MealPicker';
import { isMealType, useNutritionStore, type FoodRef, type MealType } from '@/store/nutritionStore';
import { useToday } from '@/hooks/useToday';
import { successFeedback } from '@/lib/haptics';
import { newId } from '@/lib/ids';
import { colors } from '@/theme/colors';
import { kcalFromMacros } from '@/utils/nutrition';
import { quickAddSchema, resolveKcal, type QuickAddValues } from '@/components/food/quickAddSchema';
import { formatNumber } from '@/utils/number';
import { mealForTime } from '@/utils/portion';

/**
 * Quick add: log calories and macros directly (restaurant meals, home cooking, labels the
 * barcode scanner doesn't know). Optionally saved as a custom food for one-tap reuse.
 */
export default function QuickAdd() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string; name?: string }>();
  const today = useToday();
  const addEntry = useNutritionStore((s) => s.addEntry);

  const { control, handleSubmit, formState } = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      name: params.name ?? '',
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
      portionGrams: null,
      meal: (isMealType(params.meal) ? params.meal : mealForTime()) as MealType,
      saveAsFood: false,
    },
  });
  const values = useWatch({ control });
  const macroKcal = kcalFromMacros(values.protein ?? 0, values.carbs ?? 0, values.fat ?? 0);
  const hasMacros = values.protein != null || values.carbs != null || values.fat != null;
  const mismatch =
    values.kcal != null && hasMacros && Math.abs(values.kcal - macroKcal) > Math.max(25, values.kcal * 0.1);

  const onSubmit = (v: QuickAddValues) => {
    const kcal = resolveKcal(v);
    const macros = { kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0 };
    const name = v.name || t('food.quickAdd');

    let food: FoodRef | undefined;
    if (v.saveAsFood) {
      const grams = v.portionGrams;
      food = {
        code: `custom:${newId()}`,
        name,
        base: 'g',
        source: 'custom',
        // With a weight we can store true per-100 g values; without, the food is serving-only.
        servingSize: grams ?? 100,
        servingOnly: grams === null,
        per100: grams
          ? {
              kcal: Math.round((kcal / grams) * 100),
              protein: Math.round((macros.protein / grams) * 1000) / 10,
              carbs: Math.round((macros.carbs / grams) * 1000) / 10,
              fat: Math.round((macros.fat / grams) * 1000) / 10,
            }
          : macros,
      };
    }

    addEntry(
      today,
      {
        meal: v.meal,
        name,
        foodCode: food?.code,
        quantity: 1,
        unit: food ? 'serving' : 'portion',
        amount: v.portionGrams ?? undefined,
        macros,
      },
      food,
    );
    successFeedback();
    router.back();
  };

  const errorText = (key?: string) =>
    key === 'required'
      ? t('food.quickAddRequired')
      : key === 'nameRequired'
        ? t('food.nameRequired')
        : key
          ? t('errors.invalidNumber')
          : undefined;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {t('food.quickAdd')}
        </Text>
        <IconButton
          icon={X}
          variant="ghost"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <View>
                <Text className="mb-2 ml-1 font-medium text-muted">{t('food.foodName')}</Text>
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('food.foodNamePlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  accessibilityLabel={t('food.foodName')}
                  className={`h-14 rounded-xl border bg-surface px-4 text-lg text-foreground ${fieldState.error ? 'border-danger' : 'border-border'}`}
                />
                {fieldState.error && (
                  <Text className="ml-1 mt-1 text-sm text-danger-text">
                    {errorText(fieldState.error.message)}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="kcal"
            render={({ field, fieldState }) => (
              <NumberField
                label={t('common.kcal')}
                value={field.value}
                onChangeValue={field.onChange}
                onBlur={field.onBlur}
                unit={t('common.kcal')}
                placeholder={hasMacros ? formatNumber(macroKcal, i18n.language, 0) : '0'}
                error={errorText(fieldState.error?.message)}
              />
            )}
          />

          <View className="flex-row gap-3">
            {(['protein', 'carbs', 'fat'] as const).map((macro) => (
              <Controller
                key={macro}
                control={control}
                name={macro}
                render={({ field, fieldState }) => (
                  <NumberField
                    className="flex-1"
                    label={t(`food.${macro}`)}
                    value={field.value}
                    onChangeValue={field.onChange}
                    onBlur={field.onBlur}
                    decimals={1}
                    unit="g"
                    placeholder="0"
                    error={fieldState.error ? t('errors.invalidNumber') : undefined}
                  />
                )}
              />
            ))}
          </View>

          {hasMacros && (
            <Text className={`ml-1 text-sm ${mismatch ? 'text-warning-text' : 'text-subtle'}`}>
              {mismatch
                ? t('food.macrosMismatch', { value: formatNumber(macroKcal, i18n.language, 0) })
                : t('food.macrosAddUpTo', { value: formatNumber(macroKcal, i18n.language, 0) })}
            </Text>
          )}

          <Controller
            control={control}
            name="portionGrams"
            render={({ field }) => (
              <NumberField
                label={t('food.portionWeightOptional')}
                value={field.value}
                onChangeValue={field.onChange}
                unit="g"
                placeholder="—"
              />
            )}
          />

          <Controller
            control={control}
            name="meal"
            render={({ field }) => (
              <View>
                <Text className="mb-2 ml-1 font-medium text-muted">{t('food.meal')}</Text>
                <MealPicker value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={control}
            name="saveAsFood"
            render={({ field }) => (
              <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-4">
                <View className="flex-1 pr-3">
                  <Text className="font-semibold text-foreground">{t('food.saveAsCustomFood')}</Text>
                  <Text className="text-sm text-subtle">{t('food.saveAsCustomFoodHint')}</Text>
                </View>
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  accessibilityLabel={t('food.saveAsCustomFood')}
                  trackColor={{ true: colors.primary, false: colors['surface-elevated'] }}
                />
              </View>
            )}
          />
        </ScrollView>

        <View
          className="border-t border-border px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            label={t('food.addToMeal', { meal: t(`meals.${values.meal ?? 'snack'}`) })}
            size="lg"
            className="w-full rounded-2xl"
            loading={formState.isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
