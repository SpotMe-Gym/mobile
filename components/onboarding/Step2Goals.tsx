import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

export const ACTIVITY_LEVELS = [
  { labelKey: 'onboarding.sedentary', descKey: 'onboarding.sedentaryDesc', label: 'Sedentary', multiplier: 1.2 },
  { labelKey: 'onboarding.lightlyActive', descKey: 'onboarding.lightlyActiveDesc', label: 'Lightly Active', multiplier: 1.375 },
  { labelKey: 'onboarding.moderatelyActive', descKey: 'onboarding.moderatelyActiveDesc', label: 'Moderately Active', multiplier: 1.55 },
  { labelKey: 'onboarding.veryActive', descKey: 'onboarding.veryActiveDesc', label: 'Very Active', multiplier: 1.725 },
  { labelKey: 'onboarding.superActive', descKey: 'onboarding.superActiveDesc', label: 'Super Active', multiplier: 1.9 },
] as const;

export const GOALS = [
  { labelKey: 'onboarding.loseWeight', label: 'Lose Weight', calOffset: -500 },
  { labelKey: 'onboarding.maintainWeight', label: 'Maintain Weight', calOffset: 0 },
  { labelKey: 'onboarding.gainMuscle', label: 'Gain Muscle', calOffset: 300 },
] as const;

interface Step2GoalsProps {
  activityIndex: number | null;
  setActivityIndex: (i: number) => void;
  goalIndex: number | null;
  setGoalIndex: (i: number) => void;
}

export function Step2Goals({ activityIndex, setActivityIndex, goalIndex, setGoalIndex }: Step2GoalsProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Text className="text-3xl font-bold text-white mb-2">{t('onboarding.goalsAndActivity')}</Text>
      <Text className="text-zinc-400 text-lg mb-8">{t('onboarding.helpUsCalculate')}</Text>

      <Text className="text-white font-bold text-lg mb-4">{t('onboarding.howActiveAreYou')}</Text>
      <View className="gap-3 mb-8">
        {ACTIVITY_LEVELS.map((level, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActivityIndex(i)}
            className={`flex-row justify-between items-center p-4 rounded-xl border ${activityIndex === i ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <View>
              <Text className={`font-bold ${activityIndex === i ? 'text-white' : 'text-zinc-300'}`}>{t(level.labelKey)}</Text>
              <Text className="text-zinc-500 text-xs mt-1">{t(level.descKey)}</Text>
            </View>
            {activityIndex === i && <View className="h-4 w-4 bg-blue-500 rounded-full" />}
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-white font-bold text-lg mb-4">{t('onboarding.whatIsYourGoal')}</Text>
      <View className="gap-3">
        {GOALS.map((g, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setGoalIndex(i)}
            className={`flex-row justify-between items-center p-4 rounded-xl border ${goalIndex === i ? 'bg-green-600/20 border-green-500' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <Text className={`font-bold ${goalIndex === i ? 'text-white' : 'text-zinc-300'}`}>{t(g.labelKey)}</Text>
            {goalIndex === i && <View className="h-4 w-4 bg-green-500 rounded-full" />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
