import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Meal, useNutritionStore } from '../../store/nutritionStore';
import { Plus, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface MealListProps {
  meals: Meal[];
  date: string;
}

export const MealList = React.memo(function MealList({ meals, date }: MealListProps) {
  const removeFood = useNutritionStore(s => s.removeFood);
  const router = useRouter();
  const { t } = useTranslation();

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
                <Text className="text-zinc-600 mb-2">{t('food.noFoodLoggedYet')}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Plus} size={16} color="#3b82f6" />}
                  label={t('food.addFood')}
                  onPress={() => router.push({ pathname: '/nutrition/search', params: { meal: meal.name } })}
                  className="text-blue-500"
                />
              </Card>
            ) : (
              <View className="gap-2">
                {meal.foods.map((food) => (
                  <Card key={food.id} className="bg-zinc-900 border border-zinc-800 flex-row justify-between items-center py-3">
                    <View>
                      <Text className="text-white font-medium">{food.name}</Text>
                      <Text className="text-zinc-500 text-xs">{food.calories} kcal • {food.protein}p • {food.carbs}c • {food.fat}f</Text>
                    </View>
                    <Button
                      size="icon"
                      variant="ghost"
                      icon={<Icon icon={Trash2} size={16} color="#ef4444" />}
                      onPress={() => removeFood(date, meal.name, food.id)}
                    />
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Icon icon={Plus} size={16} color="#3b82f6" />}
                  label={t('food.addItemTo', { meal: meal.name })}
                  onPress={() => router.push({ pathname: '/nutrition/search', params: { meal: meal.name } })}
                  className="mt-2 bg-zinc-800/50 border-dashed"
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
});
