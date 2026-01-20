import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';


export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros?: { [key: string]: number };
}

export interface Meal {
  name: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  foods: FoodItem[];
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  meals: Meal[];
}

export interface NutritionState {
  logs: { [date: string]: DailyLog }; // Keyed by date for O(1) access

  // Actions
  addFood: (date: string, mealName: Meal['name'], food: FoodItem) => void;
  removeFood: (date: string, mealName: Meal['name'], foodId: string) => void;
  getDailyTotals: (date: string) => { calories: number; protein: number; carbs: number; fat: number };
}

const INITIAL_MEALS: Meal[] = [
  { name: 'Breakfast', foods: [] },
  { name: 'Lunch', foods: [] },
  { name: 'Dinner', foods: [] },
  { name: 'Snack', foods: [] },
];

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      logs: {},

      addFood: (date, mealName, food) => set((state) => {
        const currentLog = state.logs[date] || { date, meals: JSON.parse(JSON.stringify(INITIAL_MEALS)) };
        const updatedMeals = currentLog.meals.map(meal => {
          if (meal.name === mealName) {
            return { ...meal, foods: [...meal.foods, food] };
          }
          return meal;
        });

        return {
          logs: {
            ...state.logs,
            [date]: { ...currentLog, meals: updatedMeals }
          }
        };
      }),

      removeFood: (date, mealName, foodId) => set((state) => {
        const currentLog = state.logs[date];
        if (!currentLog) return state;

        const updatedMeals = currentLog.meals.map(meal => {
          if (meal.name === mealName) {
            return { ...meal, foods: meal.foods.filter(f => f.id !== foodId) };
          }
          return meal;
        });

        return {
          logs: {
            ...state.logs,
            [date]: { ...currentLog, meals: updatedMeals }
          }
        };
      }),

      getDailyTotals: (date) => {
        const log = get().logs[date];
        if (!log) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

        return log.meals.reduce((acc, meal) => {
          meal.foods.forEach(food => {
            acc.calories += food.calories || 0;
            acc.protein += food.protein || 0;
            acc.carbs += food.carbs || 0;
            acc.fat += food.fat || 0;
          });
          return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    }),
    {
      name: 'nutrition-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
