import { z } from 'zod';
import { kcalFromMacros } from '@/features/nutrition/utils/nutrition';

const optionalAmount = (max: number) => z.number().min(0).max(max).nullable();

export const quickAddSchema = z
  .object({
    name: z.string().trim().max(80),
    kcal: optionalAmount(5000),
    protein: optionalAmount(500),
    carbs: optionalAmount(1000),
    fat: optionalAmount(500),
    portionGrams: z.number().positive().max(5000).nullable(),
    meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    saveAsFood: z.boolean(),
  })
  .refine((v) => v.kcal !== null || v.protein !== null || v.carbs !== null || v.fat !== null, {
    path: ['kcal'],
    message: 'required',
  })
  .refine((v) => !v.saveAsFood || v.name.length > 0, { path: ['name'], message: 'nameRequired' });

export type QuickAddValues = z.infer<typeof quickAddSchema>;

/** Energy to log: the typed kcal, or — when left empty — what the macros add up to. */
export function resolveKcal(v: Pick<QuickAddValues, 'kcal' | 'protein' | 'carbs' | 'fat'>): number {
  return v.kcal ?? kcalFromMacros(v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0);
}
