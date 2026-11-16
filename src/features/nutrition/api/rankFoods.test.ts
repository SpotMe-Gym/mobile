import { plausible, rankFoods, scoreFood, tokens, type Candidate } from '@/features/nutrition/api/rankFoods';
import type { FoodRef } from '@/features/nutrition/nutritionStore';

const food = (name: string, patch: Partial<FoodRef> = {}, extra: Omit<Candidate, 'ref'> = {}): Candidate => ({
  ref: {
    code: name + (patch.brand ?? '') + (patch.per100?.kcal ?? ''),
    name,
    base: 'g',
    per100: { kcal: 110, protein: 23, carbs: 0, fat: 2 },
    source: 'off',
    ...patch,
  },
  ...extra,
});
const names = (list: FoodRef[]) => list.map((f) => f.name);

describe('food search ranking', () => {
  it('reads words without accents or filler', () => {
    expect(tokens('Petto di Pollo à la crème')).toEqual(['petto', 'pollo', 'creme']);
  });

  it('puts the product that is just the query first', () => {
    const ranked = rankFoods('petto di pollo', [
      food('Insalata con petto di pollo e verdure grigliate'),
      food('Petto di pollo a fette'),
      food('Petto di pollo'),
      food('Pollo arrosto'),
    ]);
    expect(names(ranked).slice(0, 2)).toEqual(['Petto di pollo', 'Petto di pollo a fette']);
    expect(names(ranked)[3]).toBe('Pollo arrosto');
  });

  it('drops results that match none of the words, unless nothing matches', () => {
    const list = [
      food('Yogurt greco'),
      food('Biscotti al cioccolato', { per100: { kcal: 480, protein: 6, carbs: 65, fat: 21 } }),
    ];
    expect(names(rankFoods('yogurt', list))).toEqual(['Yogurt greco']);
    expect(rankFoods('tofu', list)).toHaveLength(2);
  });

  it("prefers products sold in the user's country and scanned often", () => {
    const here = food('Yogurt greco', { brand: 'A' }, { countries: ['en:italy'] });
    const abroad = food('Yogurt greco', { brand: 'B' }, { countries: ['en:germany'] });
    const popular = food('Yogurt greco', { brand: 'C' }, { countries: ['en:germany'], scans: 400 });
    expect(rankFoods('yogurt greco', [abroad, here], 'it').map((f) => f.brand)).toEqual(['A', 'B']);
    expect(scoreFood('yogurt greco', popular).score).toBeGreaterThan(scoreFood('yogurt greco', abroad).score);
  });

  it('finds a brand asked for by name', () => {
    const ranked = rankFoods('nutella ferrero', [
      food('Crema alle nocciole', { brand: 'Altra', per100: { kcal: 540, protein: 6, carbs: 57, fat: 31 } }),
      food('Nutella', { brand: 'Ferrero', per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 } }),
    ]);
    expect(ranked[0]!.name).toBe('Nutella');
    expect(ranked).toHaveLength(1);
  });

  it('merges duplicates and removes entries with impossible numbers', () => {
    const typo = food('Petto di pollo', {
      brand: 'X',
      per100: { kcal: 1100, protein: 23, carbs: 0, fat: 2 },
    });
    const mismatch = food('Petto di pollo', {
      brand: 'Y',
      per100: { kcal: 20, protein: 23, carbs: 30, fat: 12 },
    });
    expect(plausible(typo.ref)).toBe(false);
    expect(plausible(mismatch.ref)).toBe(false);
    expect(plausible(food('Coca Cola Zero', { per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } }).ref)).toBe(
      true,
    );
    const ranked = rankFoods('petto di pollo', [
      food('Petto di pollo'),
      food('petto di pollo'),
      typo,
      mismatch,
    ]);
    expect(ranked).toHaveLength(1);
  });

  it('keeps only full matches when there are plenty', () => {
    const full = Array.from({ length: 6 }, (_, i) => food(`Yogurt greco ${i}`, { brand: `B${i}` }));
    const ranked = rankFoods('yogurt greco', [...full, food('Yogurt alla fragola')]);
    expect(ranked).toHaveLength(6);
  });
});
