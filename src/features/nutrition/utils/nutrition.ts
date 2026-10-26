import type { Goal, ActivityLevel, Gender } from '@/features/profile/userStore';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/** Scales per-100 g (or per-100 ml) values to an amount in grams (or ml). */
export function macrosForAmount(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
  };
}

/** Energy implied by macros (Atwater factors). */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  super: 1.9,
};

export const GOAL_KCAL_OFFSET: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

export const DEFAULT_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 } as const;
export const MIN_KCAL = 1200;
export const MAX_KCAL = 10000;

/** Splits a calorie target into grams using the default 30/40/30 ratio. */
export function splitCalories(kcal: number): Omit<Macros, 'kcal'> {
  return {
    protein: Math.round((kcal * DEFAULT_SPLIT.protein) / 4),
    carbs: Math.round((kcal * DEFAULT_SPLIT.carbs) / 4),
    fat: Math.round((kcal * DEFAULT_SPLIT.fat) / 9),
  };
}

/** Mifflin-St Jeor BMR × activity multiplier + goal offset, split 30/40/30. */
export function calculateTargets(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activity: ActivityLevel;
  goal: Goal;
}): Macros {
  let bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  if (input.gender === 'male') bmr += 5;
  else if (input.gender === 'female') bmr -= 161;
  else bmr -= 78; // midpoint of the two sex-specific constants

  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activity];
  const kcal = Math.round(Math.min(MAX_KCAL, Math.max(MIN_KCAL, tdee + GOAL_KCAL_OFFSET[input.goal])));
  return { kcal, ...splitCalories(kcal) };
}

/** Whether a weight change moves the user toward their goal (null = neutral). */
export function isWeightChangeFavourable(diffKg: number, goal: Goal | null): boolean | null {
  if (diffKg === 0 || goal === null || goal === 'maintain') return null;
  return goal === 'gain' ? diffKg > 0 : diffKg < 0;
}
