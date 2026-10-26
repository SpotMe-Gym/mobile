import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Step1Bio } from '@/features/onboarding/components/Step1Bio';
import { Step2Goals } from '@/features/onboarding/components/Step2Goals';
import { Step3Nutrition } from '@/features/onboarding/components/Step3Nutrition';
import { onboardingSchema, STEP_FIELDS, type OnboardingValues } from '@/features/onboarding/onboardingSchema';
import { useUserStore, DEFAULT_TARGETS } from '@/features/profile/userStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { calculateTargets } from '@/features/nutrition/utils/nutrition';
import { successFeedback } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/cn';

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const { t } = useTranslation();
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const addWeight = useWeightStore((s) => s.addEntry);
  const [step, setStep] = useState<Step>(1);

  const { control, trigger, getValues, setValue, handleSubmit } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      gender: null,
      age: 25,
      heightCm: null,
      weightKg: null,
      activity: null,
      goal: null,
      targets: DEFAULT_TARGETS,
      ratioLocked: true,
    },
  });

  const next = async () => {
    if (!(await trigger(STEP_FIELDS[step]))) return;
    if (step === 2) {
      const v = getValues();
      if (v.weightKg !== null && v.heightCm !== null && v.gender && v.activity && v.goal) {
        setValue(
          'targets',
          calculateTargets({
            weightKg: v.weightKg,
            heightCm: v.heightCm,
            age: v.age,
            gender: v.gender,
            activity: v.activity,
            goal: v.goal,
          }),
        );
      }
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };

  const finish = handleSubmit((v) => {
    if (v.weightKg !== null) addWeight(v.weightKg);
    completeOnboarding({
      name: v.name.trim(),
      gender: v.gender,
      age: v.age,
      heightCm: v.heightCm,
      activityLevel: v.activity,
      goal: v.goal,
      targets: v.targets,
    });
    successFeedback();
    // Stack.Protected swaps to the home screen once the guard flips — no manual redirect.
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-6">
        <View className="mb-8 flex-row items-center justify-between">
          {step > 1 ? (
            <IconButton
              icon={ChevronLeft}
              accessibilityLabel={t('common.back')}
              onPress={() => setStep((s) => (s - 1) as Step)}
            />
          ) : (
            <View className="w-11" />
          )}
          <View
            className="flex-row gap-2"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.stepOf', { step, total: 3 })}
          >
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                className={cn('h-2 w-8 rounded-full', i <= step ? 'bg-primary' : 'bg-surface-elevated')}
              />
            ))}
          </View>
          <View className="w-11" />
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {step === 1 && <Step1Bio control={control} />}
          {step === 2 && <Step2Goals control={control} />}
          {step === 3 && <Step3Nutrition control={control} />}
        </ScrollView>

        <View className="py-4">
          <Button
            label={step === 3 ? t('onboarding.startJourney') : t('common.next')}
            onPress={() => void (step === 3 ? finish() : next())}
            variant="white"
            className="h-14 w-full rounded-xl"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
