import { toFoodRef } from '@/services/foodApi';

describe('toFoodRef', () => {
  it('keeps per-100 g values and the serving size', () => {
    const ref = toFoodRef(
      {
        code: '3017620422003',
        product_name: 'Nutella',
        brands: 'Ferrero, Nutella',
        serving_quantity: 15,
        serving_size: '15 g',
        nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
      },
      'Unknown',
    );
    expect(ref).toMatchObject({
      code: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      base: 'g',
      servingSize: 15,
      per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
    });
  });

  it('derives per-100 values from per-serving-only products', () => {
    const ref = toFoodRef(
      { code: '1', serving_quantity: 50, nutriments: { 'energy-kcal_serving': 100, proteins_serving: 5 } },
      'Unknown',
    );
    expect(ref?.per100).toMatchObject({ kcal: 200, protein: 10 });
    expect(ref?.name).toBe('Unknown');
  });

  it('detects liquids and kJ-only energy', () => {
    const ref = toFoodRef({ code: '2', serving_quantity_unit: 'ml', nutriments: { 'energy-kj_100g': 418.4 } }, 'x');
    expect(ref?.base).toBe('ml');
    expect(ref?.per100?.kcal).toBe(100);
  });
});
