import { availableUnits, baseToPortion, defaultPortion, macrosForPortion, mealForTime, portionToBase } from '@/utils/portion';
import type { FoodRef } from '@/store/nutritionStore';

const nutella: FoodRef = {
  code: '3017620422003',
  name: 'Nutella',
  base: 'g',
  per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
  servingSize: 15,
  source: 'off',
};

describe('portions', () => {
  it('converts servings, ounces and grams to grams', () => {
    expect(portionToBase(2, 'serving', nutella)).toBe(30);
    expect(portionToBase(1, 'oz', nutella)).toBeCloseTo(28.35, 1);
    expect(portionToBase(50, 'g', nutella)).toBe(50);
    expect(portionToBase(50, 'ml', nutella)).toBeNull();
  });

  it('keeps the same amount when switching units', () => {
    expect(baseToPortion(30, 'serving', nutella)).toBe(2);
    expect(baseToPortion(30, 'g', nutella)).toBe(30);
  });

  it('computes macros for 2 servings', () => {
    expect(macrosForPortion(nutella, 2, 'serving')?.kcal).toBe(162);
  });

  it('offers serving first, and oz before g for imperial users', () => {
    expect(availableUnits(nutella, false)).toEqual(['serving', 'g', 'oz']);
    expect(availableUnits(nutella, true)).toEqual(['serving', 'oz', 'g']);
    expect(availableUnits({ base: 'ml' }, false)).toEqual(['ml']);
    expect(availableUnits({ base: 'g', servingOnly: true, servingSize: 100 }, false)).toEqual(['serving']);
  });

  it('defaults to the last portion the user logged', () => {
    expect(defaultPortion(nutella, false)).toEqual({ quantity: 1, unit: 'serving' });
    expect(defaultPortion(nutella, false, { quantity: 20, unit: 'g' })).toEqual({ quantity: 20, unit: 'g' });
    expect(defaultPortion({ base: 'g' }, false)).toEqual({ quantity: 100, unit: 'g' });
  });

  it('suggests a meal from the time of day', () => {
    expect(mealForTime(new Date(2026, 0, 1, 8))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 1, 13))).toBe('lunch');
    expect(mealForTime(new Date(2026, 0, 1, 20))).toBe('dinner');
    expect(mealForTime(new Date(2026, 0, 1, 16))).toBe('snack');
  });
});
