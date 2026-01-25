import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Meal, useNutritionStore } from '../../store/nutritionStore';
import { Plus, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface MealListProps {
  meals: Meal[];
  date: string;
}

export function MealList({ meals, date }: MealListProps) {
  const { removeFood } = useNutritionStore();
  const router = useRouter();

  return (
    <View className="pb-10">
      {meals.map((meal) => {
        const mealCalories = meal.foods.reduce((acc, f) => acc + f.calories, 0);

        return (
          <View key={meal.name} className="mb-6">
            <View className="flex-row justify-between items-center mb-2 px-1">
              <Text className="text-white text-lg font-bold">{meal.name}</Text>
              <Text className="text-zinc-400 text-sm">{mealCalories} kcal</Text>
            </View>

            {meal.foods.length === 0 ? (
              <Card className="bg-zinc-900 border border-zinc-800 py-6 items-center border-dashed">
                <Text className="text-zinc-600 mb-2">No food logged yet</Text>
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => router.push('/nutrition/search')}
                >
                  <Plus size={16} color="#3b82f6" />
                  <Text className="text-blue-500 font-bold ml-1">Add Food</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <View className="gap-2">
                {meal.foods.map((food) => (
                  <Card key={food.id} className="bg-zinc-900 border border-zinc-800 flex-row justify-between items-center py-3">
                    <View>
                      <Text className="text-white font-medium">{food.name}</Text>
                      <Text className="text-zinc-500 text-xs">{food.calories} kcal • {food.protein}p • {food.carbs}c • {food.fat}f</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFood(date, meal.name, food.id)}
                      className="p-2"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </Card>
                ))}
                <TouchableOpacity
                  className="flex-row items-center justify-center mt-2 py-2 bg-zinc-800/50 rounded-lg border border-zinc-800 border-dashed"
                  onPress={() => router.push('/nutrition/search')}
                >
                  <Plus size={16} color="#3b82f6" />
                  <Text className="text-blue-500 font-bold ml-1 text-sm bg-transparent">Add item to {meal.name}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
