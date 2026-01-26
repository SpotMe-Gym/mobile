import { View, Text, TouchableOpacity } from 'react-native';

export const ACTIVITY_LEVELS = [
  { label: 'Sedentary', desc: 'Office job, little exercise', multiplier: 1.2 },
  { label: 'Lightly Active', desc: '1-3 days/week exercise', multiplier: 1.375 },
  { label: 'Moderately Active', desc: '3-5 days/week exercise', multiplier: 1.55 },
  { label: 'Very Active', desc: '6-7 days/week hard exercise', multiplier: 1.725 },
  { label: 'Super Active', desc: 'Physical job or training 2x/day', multiplier: 1.9 },
] as const;

export const GOALS = [
  { label: 'Lose Weight', calOffset: -500 },
  { label: 'Maintain Weight', calOffset: 0 },
  { label: 'Gain Muscle', calOffset: 300 }, // Slight surplus for lean gain
] as const;

interface Step2GoalsProps {
  activityIndex: number | null;
  setActivityIndex: (i: number) => void;
  goalIndex: number | null;
  setGoalIndex: (i: number) => void;
}

export function Step2Goals({ activityIndex, setActivityIndex, goalIndex, setGoalIndex }: Step2GoalsProps) {
  return (
    <View>
      <Text className="text-3xl font-bold text-white mb-2">Goals & Activity</Text>
      <Text className="text-zinc-400 text-lg mb-8">Help us calculate your needs.</Text>

      <Text className="text-white font-bold text-lg mb-4">How active are you?</Text>
      <View className="gap-3 mb-8">
        {ACTIVITY_LEVELS.map((level, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActivityIndex(i)}
            className={`flex-row justify-between items-center p-4 rounded-xl border ${activityIndex === i ? 'bg-blue-600/20 border-blue-500' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <View>
              <Text className={`font-bold ${activityIndex === i ? 'text-white' : 'text-zinc-300'}`}>{level.label}</Text>
              <Text className="text-zinc-500 text-xs mt-1">{level.desc}</Text>
            </View>
            {activityIndex === i && <View className="h-4 w-4 bg-blue-500 rounded-full" />}
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-white font-bold text-lg mb-4">What is your goal?</Text>
      <View className="gap-3">
        {GOALS.map((g, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setGoalIndex(i)}
            className={`flex-row justify-between items-center p-4 rounded-xl border ${goalIndex === i ? 'bg-green-600/20 border-green-500' : 'bg-zinc-900 border-zinc-800'}`}
          >
            <Text className={`font-bold ${goalIndex === i ? 'text-white' : 'text-zinc-300'}`}>{g.label}</Text>
            {goalIndex === i && <View className="h-4 w-4 bg-green-500 rounded-full" />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
