import { quickAddSchema, resolveKcal } from '@/components/food/quickAddSchema';

const base = { name: '', kcal: null, protein: null, carbs: null, fat: null, portionGrams: null, meal: 'lunch' as const, saveAsFood: false };

describe('quick add', () => {
  it('requires calories or a macro', () => {
    expect(quickAddSchema.safeParse(base).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...base, protein: 30 }).success).toBe(true);
  });
  it('requires a name only when saving as a food', () => {
    expect(quickAddSchema.safeParse({ ...base, kcal: 500, saveAsFood: true }).success).toBe(false);
    expect(quickAddSchema.safeParse({ ...base, kcal: 500, saveAsFood: true, name: 'Bowl' }).success).toBe(true);
  });
  it('falls back to macro energy when kcal is empty', () => {
    expect(resolveKcal({ kcal: null, protein: 45, carbs: 70, fat: 18 })).toBe(622);
    expect(resolveKcal({ kcal: 650, protein: 45, carbs: 70, fat: 18 })).toBe(650);
  });
});
