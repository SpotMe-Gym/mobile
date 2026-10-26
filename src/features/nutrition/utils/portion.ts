import type { FoodRef, MealType, PortionUnit } from '@/features/nutrition/nutritionStore';
import { OZ_TO_G } from '@/shared/utils/unitConversion';
import { macrosForAmount, type Macros } from '@/features/nutrition/utils/nutrition';

/** Converts a portion to the food's base unit (g or ml). Null when it can't be expressed. */
export function portionToBase(
  quantity: number,
  unit: PortionUnit,
  food: Pick<FoodRef, 'servingSize' | 'base'>,
): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  switch (unit) {
    case 'serving':
      return food.servingSize ? quantity * food.servingSize : null;
    case 'oz':
      return food.base === 'g' ? quantity * OZ_TO_G : null;
    case 'g':
    case 'ml':
      return unit === food.base ? quantity : null;
  }
}

export function macrosForPortion(food: FoodRef, quantity: number, unit: PortionUnit): Macros | null {
  if (!food.per100) return null;
  const base = portionToBase(quantity, unit, food);
  return base === null ? null : macrosForAmount(food.per100, base);
}

/** Units offered for a food, most useful first. */
export function availableUnits(
  food: Pick<FoodRef, 'servingSize' | 'base' | 'servingOnly'>,
  prefersImperial: boolean,
): PortionUnit[] {
  if (food.servingOnly) return ['serving'];
  const units: PortionUnit[] = [];
  if (food.servingSize) units.push('serving');
  if (food.base === 'ml') {
    units.push('ml');
  } else if (prefersImperial) {
    units.push('oz', 'g');
  } else {
    units.push('g', 'oz');
  }
  return units;
}

export function defaultPortion(
  food: Pick<FoodRef, 'servingSize' | 'base' | 'servingOnly'>,
  prefersImperial: boolean,
  last?: { quantity: number; unit: PortionUnit },
): { quantity: number; unit: PortionUnit } {
  const units = availableUnits(food, prefersImperial);
  // What the user logged last time is the best predictor of what they'll log now.
  if (last && units.includes(last.unit) && last.quantity > 0) return last;
  const first = units[0] ?? 'g';
  switch (first) {
    case 'serving':
      return { quantity: 1, unit: 'serving' };
    case 'oz':
      return { quantity: 3.5, unit: 'oz' };
    default:
      return { quantity: 100, unit: first };
  }
}

export const QUICK_AMOUNTS: Record<PortionUnit, readonly number[]> = {
  serving: [0.5, 1, 1.5, 2, 3],
  g: [25, 50, 100, 150, 200],
  ml: [100, 200, 250, 330, 500],
  oz: [1, 2, 3.5, 5, 8],
};

export const STEP: Record<PortionUnit, number> = { serving: 0.5, g: 5, ml: 10, oz: 0.5 };

/** Decimals allowed when typing a quantity in this unit. */
export const DECIMALS: Record<PortionUnit, number> = { serving: 2, g: 0, ml: 0, oz: 1 };

/** Sensible default meal for the current time of day. */
export function mealForTime(date: Date = new Date()): MealType {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 18 && h < 22) return 'dinner';
  return 'snack';
}

/** Inverse of portionToBase — used to keep the same amount when switching units. */
export function baseToPortion(
  base: number,
  unit: PortionUnit,
  food: Pick<FoodRef, 'servingSize' | 'base'>,
): number | null {
  switch (unit) {
    case 'serving':
      return food.servingSize ? Math.round((base / food.servingSize) * 100) / 100 : null;
    case 'oz':
      return food.base === 'g' ? Math.round((base / OZ_TO_G) * 10) / 10 : null;
    case 'g':
    case 'ml':
      return unit === food.base ? Math.round(base) : null;
  }
}
