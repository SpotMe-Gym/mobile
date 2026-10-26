import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchProduct, searchProducts, deviceCountryCode } from '@/features/nutrition/api/foodApi';
import { isApiError } from '@/shared/lib/http';
import type { FoodRef } from '@/features/nutrition/nutritionStore';

export const foodKeys = {
  all: ['food'] as const,
  searches: () => [...foodKeys.all, 'search'] as const,
  search: (query: string, country: string, language: string) =>
    [...foodKeys.searches(), { query, country, language }] as const,
  products: () => [...foodKeys.all, 'product'] as const,
  product: (code: string) => [...foodKeys.products(), code] as const,
};

const DAY = 1000 * 60 * 60 * 24;

/** Remote search. Runs only for submitted queries — Open Food Facts rate-limits search hard. */
export function useFoodSearch(query: string) {
  const { t, i18n } = useTranslation();
  const country = deviceCountryCode();
  const q = query.trim();
  return useQuery({
    queryKey: foodKeys.search(q.toLowerCase(), country, i18n.language),
    queryFn: ({ signal }) =>
      searchProducts(q, { country, language: i18n.language, fallbackName: t('food.unknownProduct'), signal }),
    enabled: q.length >= 2,
    staleTime: DAY / 24,
    gcTime: DAY,
    placeholderData: keepPreviousData,
  });
}

/** Product by barcode. `initial` (from search results or history) renders instantly. */
export function useProduct(code: string, initial?: FoodRef) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: foodKeys.product(code),
    queryFn: ({ signal }) => fetchProduct(code, t('food.unknownProduct'), signal),
    enabled: code.length > 0 && !code.startsWith('custom:'),
    staleTime: 7 * DAY,
    gcTime: 7 * DAY,
    // Only seed the cache when the initial ref actually has nutrition; legacy refs refetch.
    initialData: initial?.per100 ? initial : undefined,
    retry: (count, error) => !(isApiError(error) && error.kind === 'not-found') && count < 2,
  });
}

/** Seeds the product cache so the entry sheet opens instantly from a list tap. */
export function usePrimeProduct() {
  const client = useQueryClient();
  return (food: FoodRef) => {
    if (food.per100) client.setQueryData(foodKeys.product(food.code), food);
  };
}
