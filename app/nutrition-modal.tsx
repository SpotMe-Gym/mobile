import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useNutritionStore } from '../store/nutritionStore';
import { MacroCarousel } from '../components/nutrition/MacroCarousel';
import { MealList } from '../components/nutrition/MealList';


export default function NutritionModal() {
  const router = useRouter();
  const { logs, getDailyTotals } = useNutritionStore();

  // For now, hardcode today's date or use a simple formatter
  // In a real app, I'd bring in date-fns properly or use Intl
  const today = new Date().toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const totals = getDailyTotals(today);
  const currentLog = logs[today] || {
    meals: [
      { name: 'Breakfast', foods: [] },
      { name: 'Lunch', foods: [] },
      { name: 'Dinner', foods: [] },
      { name: 'Snack', foods: [] },
    ]
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-4 py-4 border-b border-zinc-900">
          <View>
            <Text className="text-white text-xl font-bold">Nutrition</Text>
            <Text className="text-zinc-500 text-sm">{dateLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 bg-zinc-900 rounded-full items-center justify-center"
          >
            <X size={20} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-6">
          <MacroCarousel totals={totals} />
          <MealList meals={currentLog.meals} date={today} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
