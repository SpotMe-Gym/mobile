import { sumEntries, useNutritionStore, type FoodRef } from '@/features/nutrition/nutritionStore';
import { macrosForPortion } from '@/features/nutrition/utils/portion';

const food: FoodRef = { code: '42', name: 'Oats', base: 'g', per100: { kcal: 380, protein: 13, carbs: 60, fat: 7 }, servingSize: 40, source: 'off' };

beforeEach(() => useNutritionStore.getState().reset());

it('logs the same product twice with distinct ids and removes only one', () => {
  const macros = macrosForPortion(food, 1, 'serving')!;
  const entry = { meal: 'breakfast' as const, name: food.name, foodCode: food.code, quantity: 1, unit: 'serving' as const, macros };
  useNutritionStore.getState().addEntry('2026-10-24', entry, food);
  useNutritionStore.getState().addEntry('2026-10-24', entry, food);
  const day = useNutritionStore.getState().days['2026-10-24'] ?? [];
  expect(day).toHaveLength(2);
  expect(day[0]?.id).not.toBe(day[1]?.id);

  useNutritionStore.getState().removeEntry('2026-10-24', day[0]!.id);
  expect(useNutritionStore.getState().days['2026-10-24']).toHaveLength(1);
});

it('stores history per 100 g (re-adding from history is not double-scaled)', () => {
  const macros = macrosForPortion(food, 2, 'serving')!;
  useNutritionStore.getState().addEntry('2026-10-24', { meal: 'breakfast', name: 'Oats', quantity: 2, unit: 'serving', macros }, food);
  const history = useNutritionStore.getState().foods['42'];
  expect(history?.per100).toEqual(food.per100);
  expect(history?.lastPortion).toEqual({ quantity: 2, unit: 'serving' });
  expect(sumEntries(useNutritionStore.getState().days['2026-10-24'] ?? []).kcal).toBe(304);
});
