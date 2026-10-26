import { Pressable, Text, View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { ActivityLevel, Goal } from '@/features/profile/userStore';
import type { OnboardingValues } from '@/features/onboarding/onboardingSchema';
import { useFieldError } from '@/features/onboarding/hooks/useFieldError';

const ACTIVITY: readonly ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'super'];
const GOALS: readonly Goal[] = ['lose', 'maintain', 'gain'];

function Option({
  title,
  subtitle,
  selected,
  onPress,
  tone,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  tone: 'primary' | 'success';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={cn(
        'min-h-14 flex-row items-center justify-between rounded-xl border p-4',
        selected
          ? tone === 'primary'
            ? 'border-primary bg-primary/20'
            : 'border-success bg-success/20'
          : 'border-border bg-surface',
      )}
    >
      <View className="flex-1">
        <Text className={cn('font-bold', selected ? 'text-foreground' : 'text-muted')}>{title}</Text>
        {subtitle && <Text className="mt-1 text-sm text-subtle">{subtitle}</Text>}
      </View>
      {selected && (
        <View className={cn('h-4 w-4 rounded-full', tone === 'primary' ? 'bg-primary' : 'bg-success')} />
      )}
    </Pressable>
  );
}

export function Step2Goals({ control }: { control: Control<OnboardingValues> }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  return (
    <View>
      <Text accessibilityRole="header" className="mb-2 text-3xl font-bold text-foreground">
        {t('onboarding.goalsAndActivity')}
      </Text>
      <Text className="mb-8 text-lg text-muted">{t('onboarding.helpUsCalculate')}</Text>

      <Controller
        control={control}
        name="activity"
        render={({ field, fieldState }) => (
          <View className="mb-8">
            <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
              {t('onboarding.howActiveAreYou')}
            </Text>
            <View className="gap-3" accessibilityRole="radiogroup">
              {ACTIVITY.map((level) => (
                <Option
                  key={level}
                  tone="primary"
                  title={t(`onboarding.activity.${level}`)}
                  subtitle={t(`onboarding.activity.${level}Desc`)}
                  selected={field.value === level}
                  onPress={() => field.onChange(level)}
                />
              ))}
            </View>
            {fieldState.error && (
              <Text className="ml-1 mt-2 text-sm text-danger-text">
                {fieldError(fieldState.error.message)}
              </Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="goal"
        render={({ field, fieldState }) => (
          <View>
            <Text accessibilityRole="header" className="mb-4 text-lg font-bold text-foreground">
              {t('onboarding.whatIsYourGoal')}
            </Text>
            <View className="gap-3" accessibilityRole="radiogroup">
              {GOALS.map((g) => (
                <Option
                  key={g}
                  tone="success"
                  title={t(`onboarding.goal.${g}`)}
                  selected={field.value === g}
                  onPress={() => field.onChange(g)}
                />
              ))}
            </View>
            {fieldState.error && (
              <Text className="ml-1 mt-2 text-sm text-danger-text">
                {fieldError(fieldState.error.message)}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}
