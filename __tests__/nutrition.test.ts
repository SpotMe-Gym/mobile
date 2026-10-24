import { calculateTargets, isWeightChangeFavourable, kcalFromMacros, macrosForAmount, splitCalories } from '@/utils/nutrition';
import { formatWeightValue } from '@/utils/unitConversion';

describe('calculateTargets (Mifflin-St Jeor)', () => {
  it('matches a hand-computed male maintenance example', () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; × 1.55 = 2759
    const t = calculateTargets({ weightKg: 80, heightCm: 180, age: 30, gender: 'male', activity: 'moderate', goal: 'maintain' });
    expect(t.kcal).toBe(2759);
    expect(t).toEqual({ kcal: 2759, ...splitCalories(2759) });
  });

  it('applies the goal offset and clamps to the minimum', () => {
    const t = calculateTargets({ weightKg: 45, heightCm: 150, age: 70, gender: 'female', activity: 'sedentary', goal: 'lose' });
    expect(t.kcal).toBe(1200);
  });
});

it('scales per-100 g values to a portion', () => {
  expect(macrosForAmount({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 }, 30)).toEqual({
    kcal: 162,
    protein: 1.9,
    carbs: 17.3,
    fat: 9.3,
  });
});

it('derives kcal from macros', () => {
  expect(kcalFromMacros(10, 20, 5)).toBe(165);
});

describe('isWeightChangeFavourable', () => {
  it('depends on the goal', () => {
    expect(isWeightChangeFavourable(0.5, 'gain')).toBe(true);
    expect(isWeightChangeFavourable(0.5, 'lose')).toBe(false);
    expect(isWeightChangeFavourable(-0.5, 'lose')).toBe(true);
    expect(isWeightChangeFavourable(0.5, 'maintain')).toBeNull();
    expect(isWeightChangeFavourable(0.5, null)).toBeNull();
  });
});

it('rounds weights instead of flooring them', () => {
  expect(formatWeightValue(79.96)).toBe('80.0');
});
