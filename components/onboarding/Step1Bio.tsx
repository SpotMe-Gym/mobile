import { Pressable, Text, TextInput, View } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { Ruler, User, Weight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { Icon } from '../ui/Icon';
import { NumberField } from '../ui/NumberField';
import { Stepper } from '../ui/Stepper';
import type { OnboardingValues } from './schema';
import { useFieldError } from './useFieldError';

const GENDERS = ['male', 'female', 'other'] as const;

export function Step1Bio({ control }: { control: Control<OnboardingValues> }) {
  const { t } = useTranslation();
  const fieldError = useFieldError();

  return (
    <View>
      <Text accessibilityRole="header" className="mb-2 text-4xl font-bold text-foreground">
        {t('onboarding.welcomeToSpotMe')}
      </Text>
      <Text className="mb-8 text-lg text-muted">{t('onboarding.letsStartWithBasics')}</Text>

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <View className="mb-5">
            <Text className="mb-2 ml-1 font-medium text-muted">{t('common.name')}</Text>
            <View
              className={cn(
                'h-14 flex-row items-center rounded-xl border bg-surface px-4',
                fieldState.error ? 'border-danger' : 'border-border',
              )}
            >
              <Icon icon={User} size={20} color={colors.muted} />
              <TextInput
                className="ml-3 h-full flex-1 text-lg text-foreground"
                placeholder={t('onboarding.yourName')}
                placeholderTextColor={colors.placeholder}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoComplete="given-name"
                textContentType="givenName"
                accessibilityLabel={t('common.name')}
              />
            </View>
            {fieldState.error && (
              <Text className="ml-1 mt-1 text-sm text-danger-text">
                {fieldError(fieldState.error.message)}
              </Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="gender"
        render={({ field, fieldState }) => (
          <View className="mb-5">
            <Text className="mb-2 ml-1 font-medium text-muted">{t('common.gender')}</Text>
            <View className="flex-row gap-3" accessibilityRole="radiogroup">
              {GENDERS.map((g) => {
                const selected = field.value === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => field.onChange(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    className={cn(
                      'h-12 flex-1 items-center justify-center rounded-xl border',
                      selected ? 'border-primary bg-primary' : 'border-border bg-surface',
                    )}
                  >
                    <Text
                      className={cn('font-semibold', selected ? 'text-primary-foreground' : 'text-muted')}
                    >
                      {t(`common.${g}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldState.error && (
              <Text className="ml-1 mt-1 text-sm text-danger-text">
                {fieldError(fieldState.error.message)}
              </Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="age"
        render={({ field }) => (
          <View className="mb-5">
            <Text className="mb-2 ml-1 font-medium text-muted">{t('common.age')}</Text>
            <Stepper
              label={t('common.age')}
              value={field.value}
              onChange={field.onChange}
              min={13}
              max={100}
              caption={t('common.years')}
            />
          </View>
        )}
      />

      <View className="mb-4 flex-row gap-4">
        <Controller
          control={control}
          name="heightCm"
          render={({ field, fieldState }) => (
            <NumberField
              className="flex-1"
              label={t('common.height')}
              icon={Ruler}
              unit="cm"
              placeholder="180"
              value={field.value}
              onChangeValue={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(fieldState.error?.message, t('onboarding.heightRange'))}
            />
          )}
        />
        <Controller
          control={control}
          name="weightKg"
          render={({ field, fieldState }) => (
            <NumberField
              className="flex-1"
              label={t('common.weight')}
              icon={Weight}
              unit="kg"
              decimals={1}
              placeholder="75"
              value={field.value}
              onChangeValue={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(fieldState.error?.message, t('onboarding.weightRange'))}
            />
          )}
        />
      </View>
    </View>
  );
}
