import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { z } from 'zod';
import type { FoodRef } from '@/features/nutrition/nutritionStore';
import { ApiError, fetchJson } from '@/shared/lib/http';

const OFF_BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_small_url',
  'image_url',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'product_quantity_unit',
].join(',');

// Open Food Facts asks every app to identify itself with a descriptive User-Agent.
// TODO(release): append a contact address, e.g. "(spotme.app; contact@your-domain)".
const HEADERS = {
  'User-Agent': `SpotMe/${Constants.expoConfig?.version ?? '1.0.0'} (com.spotme.app)`,
  Accept: 'application/json',
};

// OFF returns numbers as strings in some records — coerce leniently, never trust the shape.
const looseNumber = z.preprocess((v) => {
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}, z.number().optional());

const productSchema = z.object({
  code: z.coerce.string(),
  product_name: z.string().optional().catch(undefined),
  brands: z.string().optional().catch(undefined),
  image_front_small_url: z.string().optional().catch(undefined),
  image_url: z.string().optional().catch(undefined),
  serving_size: z.string().optional().catch(undefined),
  serving_quantity: looseNumber,
  serving_quantity_unit: z.string().optional().catch(undefined),
  product_quantity_unit: z.string().optional().catch(undefined),
  nutriments: z
    .object({
      'energy-kcal_100g': looseNumber,
      'energy-kj_100g': looseNumber,
      proteins_100g: looseNumber,
      carbohydrates_100g: looseNumber,
      fat_100g: looseNumber,
      'energy-kcal_serving': looseNumber,
      proteins_serving: looseNumber,
      carbohydrates_serving: looseNumber,
      fat_serving: looseNumber,
    })
    .partial()
    .catch({}),
});

type OffProduct = z.infer<typeof productSchema>;

const productResponseSchema = z.object({
  status: z.coerce.number().optional(),
  product: z.unknown().optional(),
});
const searchResponseSchema = z.object({ products: z.array(z.unknown()).catch([]) });

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Maps an OFF record to a FoodRef with nutrition per 100 g/ml. Exported for tests. */
export function toFoodRef(p: OffProduct, fallbackName: string): FoodRef | null {
  const n = p.nutriments;
  const base: 'g' | 'ml' =
    p.serving_quantity_unit?.toLowerCase() === 'ml' || p.product_quantity_unit?.toLowerCase() === 'ml'
      ? 'ml'
      : 'g';
  const servingSize = p.serving_quantity && p.serving_quantity > 0 ? p.serving_quantity : undefined;

  let kcal =
    n['energy-kcal_100g'] ?? (n['energy-kj_100g'] !== undefined ? n['energy-kj_100g'] / 4.184 : undefined);
  let protein = n.proteins_100g;
  let carbs = n.carbohydrates_100g;
  let fat = n.fat_100g;

  // Some products only publish per-serving values: derive per-100 from the serving size.
  if (kcal === undefined && servingSize && n['energy-kcal_serving'] !== undefined) {
    const f = 100 / servingSize;
    kcal = n['energy-kcal_serving'] * f;
    protein = protein ?? (n.proteins_serving !== undefined ? n.proteins_serving * f : undefined);
    carbs = carbs ?? (n.carbohydrates_serving !== undefined ? n.carbohydrates_serving * f : undefined);
    fat = fat ?? (n.fat_serving !== undefined ? n.fat_serving * f : undefined);
  }

  if (!p.code) return null;
  return {
    code: p.code,
    name: p.product_name?.trim() || fallbackName,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    imageUrl: p.image_front_small_url ?? p.image_url,
    base,
    per100:
      kcal === undefined
        ? null
        : {
            kcal: Math.round(kcal),
            protein: round1(protein ?? 0),
            carbs: round1(carbs ?? 0),
            fat: round1(fat ?? 0),
          },
    servingSize,
    servingLabel: p.serving_size?.trim() || undefined,
    source: 'off',
  };
}

export function deviceCountryCode(): string {
  return getLocales()[0]?.regionCode?.toLowerCase() ?? 'world';
}

export async function fetchProduct(
  code: string,
  fallbackName: string,
  signal?: AbortSignal,
): Promise<FoodRef> {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`;
  const json = productResponseSchema.parse(await fetchJson(url, { headers: HEADERS, signal }));
  if (json.status === 0 || !json.product) throw new ApiError('not-found');
  const parsed = productSchema.safeParse(json.product);
  if (!parsed.success) throw new ApiError('invalid-response');
  const ref = toFoodRef(parsed.data, fallbackName);
  if (!ref) throw new ApiError('not-found');
  return ref;
}

export async function searchProducts(
  query: string,
  {
    country = deviceCountryCode(),
    language = 'en',
    fallbackName,
    signal,
  }: {
    country?: string;
    language?: string;
    fallbackName: string;
    signal?: AbortSignal;
  },
): Promise<FoodRef[]> {
  const params = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '30',
    fields: FIELDS,
    cc: country,
    lc: language,
  });
  const json = searchResponseSchema.parse(
    await fetchJson(`${OFF_BASE}/cgi/search.pl?${params.toString()}`, {
      headers: HEADERS,
      signal,
      timeoutMs: 15_000,
    }),
  );
  return json.products.flatMap((raw) => {
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) return [];
    const ref = toFoodRef(parsed.data, fallbackName);
    // Results without nutrition can't be logged meaningfully — hide them.
    return ref?.per100 ? [ref] : [];
  });
}
