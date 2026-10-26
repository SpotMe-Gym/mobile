import { Pressable, Text, View } from 'react-native';
import { useController, type Control } from 'react-hook-form';
import { Info, Lock, Unlock } from 'lucide-react-native';
import { Trans, useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/shared/utils/number';
import { kcalFromMacros, MAX_KCAL, MIN_KCAL, splitCalories } from '@/features/nutrition/utils/nutrition';
import { Icon } from '@/shared/ui/Icon';
import { Stepper } from '@/shared/ui/Stepper';
import type { OnboardingValues } from '@/features/onboarding/onboardingSchema';

export function Step3Nutrition({ control }: { control: Control<OnboardingValues> }) {
  const { t, i18n } = useTranslation();
  const { field: targets } = useController({ control, name: 'targets' });
  const { field: locked } = useController({ control, name: 'ratioLocked' });
  const value = targets.value;
  const isLocked = locked.value;

  const setKcal = (kcal: number) =>
    // Locked: scale macros with the total. Unlocked: only the total target changes.
    targets.onChange(isLocked ? { kcal, ...splitCalories(kcal) } : { ...value, kcal });

  const setMacro = (macro: 'protein' | 'carbs' | 'fat', grams: number) => {
    const next = { ...value, [macro]: grams };
    // Macros fully determine energy (Atwater), so the total follows them.
    targets.onChange({
      ...next,
      kcal: Math.min(MAX_KCAL, Math.max(MIN_KCAL, kcalFromMacros(next.protein, next.carbs, next.fat))),
    });
  };

  const g = t('common.grams');
  return (
    <View>
      <Text accessibilityRole="header" className="mb-1 text-3xl font-bold text-foreground">
        {t('onboarding.oneLastThing')}
      </Text>
      <Text className="mb-6 text-base text-muted">
        <Trans
          i18nKey="onboarding.nonMedicalSuggestion"
          components={{ bold: <Text className="font-bold text-foreground" /> }}
        />
      </Text>

      <Pressable
        onPress={() => locked.onChange(!isLocked)}
        accessibilityRole="switch"
        accessibilityState={{ checked: isLocked }}
        accessibilityLabel={t('onboarding.lockRatio')}
        className="mb-4 min-h-11 flex-row items-center self-start rounded-lg border border-border bg-surface px-3 py-2"
      >
        <Icon
          icon={isLocked ? Lock : Unlock}
          size={16}
          color={isLocked ? colors['success-text'] : colors['warning-text']}
        />
        <Text className={`ml-2 font-bold ${isLocked ? 'text-success-text' : 'text-warning-text'}`}>
          {isLocked ? t('onboarding.ratioLocked') : t('onboarding.ratioUnlocked')}
        </Text>
      </Pressable>

      <View className="mb-6 gap-3 rounded-2xl border border-border bg-surface p-4">
        <Stepper
          label={t('onboarding.dailyTarget')}
          caption={t('onboarding.dailyTarget')}
          value={value.kcal}
          display={t('common.kcalValue', { value: formatNumber(value.kcal, i18n.language, 0) })}
          step={isLocked ? 50 : 10}
          min={MIN_KCAL}
          max={MAX_KCAL}
          onChange={setKcal}
          className="bg-surface-sunken"
        />
        <Stepper
          label={t('food.protein')}
          caption={t('food.protein')}
          value={value.protein}
          display={`${value.protein} ${g}`}
          step={5}
          onChange={(v) => setMacro('protein', v)}
          className="bg-surface-sunken"
        />
        <Stepper
          label={t('food.carbs')}
          caption={t('food.carbs')}
          value={value.carbs}
          display={`${value.carbs} ${g}`}
          step={5}
          onChange={(v) => setMacro('carbs', v)}
          className="bg-surface-sunken"
        />
        <Stepper
          label={t('food.fat')}
          caption={t('food.fat')}
          value={value.fat}
          display={`${value.fat} ${g}`}
          step={5}
          onChange={(v) => setMacro('fat', v)}
          className="bg-surface-sunken"
        />
      </View>

      <View className="mb-4 flex-row items-center rounded-xl border border-border bg-surface/50 p-3">
        <Icon icon={Info} size={18} color={colors.subtle} className="mr-2" />
        <Text className="flex-1 text-sm text-subtle">
          {isLocked ? t('onboarding.lockedHint') : t('onboarding.unlockedHint')}
        </Text>
      </View>
    </View>
  );
}
