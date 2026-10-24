import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '@/lib/ids';
import { addMacros, ZERO_MACROS, type Macros } from '@/utils/nutrition';
import type { DayKey } from '@/utils/date';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value);
}

/** Unit a portion was entered in. `serving` uses the food's serving size. */
export type PortionUnit = 'g' | 'ml' | 'oz' | 'serving';

/**
 * A food as a reusable reference. Nutrition is ALWAYS per 100 g / 100 ml so it can be
 * scaled to any portion; `per100` is null for legacy refs that must be re-fetched.
 */
export interface FoodRef {
  code: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  /** Whether per100 is per 100 g or per 100 ml. */
  base: 'g' | 'ml';
  per100: Macros | null;
  servingSize?: number; // in `base` units
  servingLabel?: string; // e.g. "1 biscuit (12 g)"
  /** Custom foods saved without a weight can only be logged in servings. */
  servingOnly?: boolean;
  source: 'off' | 'custom';
}

export interface FoodHistoryItem extends FoodRef {
  lastUsed: string;
  meals: MealType[];
  lastPortion?: { quantity: number; unit: PortionUnit };
  useCount: number;
}

/** One logged item. Macros are a snapshot, so history survives later edits to the food. */
export interface LogEntry {
  id: string;
  meal: MealType;
  name: string;
  brand?: string;
  foodCode?: string;
  quantity: number;
  unit: PortionUnit | 'portion';
  /** Amount in base units (g/ml) when known. */
  amount?: number;
  macros: Macros;
  loggedAt: string;
}

interface NutritionState {
  days: Record<DayKey, LogEntry[]>;
  foods: Record<string, FoodHistoryItem>;

  addEntry: (day: DayKey, entry: Omit<LogEntry, 'id' | 'loggedAt'>, food?: FoodRef) => void;
  removeEntry: (day: DayKey, entryId: string) => void;
  reset: () => void;
}

const EMPTY: LogEntry[] = [];

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set) => ({
      days: {},
      foods: {},

      addEntry: (day, entry, food) =>
        set((state) => {
          const full: LogEntry = { ...entry, id: newId(), loggedAt: new Date().toISOString() };
          const days = { ...state.days, [day]: [...(state.days[day] ?? EMPTY), full] };
          if (!food) return { days };

          const prev = state.foods[food.code];
          const meals = prev?.meals.includes(entry.meal) ? prev.meals : [...(prev?.meals ?? []), entry.meal];
          const historyItem: FoodHistoryItem = {
            ...food,
            // Keep previously known nutrition if the caller only had a partial ref.
            per100: food.per100 ?? prev?.per100 ?? null,
            meals,
            lastUsed: full.loggedAt,
            lastPortion:
              entry.unit === 'portion' ? prev?.lastPortion : { quantity: entry.quantity, unit: entry.unit },
            useCount: (prev?.useCount ?? 0) + 1,
          };
          return { days, foods: { ...state.foods, [food.code]: historyItem } };
        }),

      removeEntry: (day, entryId) =>
        set((state) => {
          const list = state.days[day];
          if (!list) return state;
          return { days: { ...state.days, [day]: list.filter((e) => e.id !== entryId) } };
        }),

      reset: () => set({ days: {}, foods: {} }),
    }),
    {
      name: 'nutrition-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted, version) => migrateNutritionState(persisted, version),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useDayEntries(day: DayKey): LogEntry[] {
  return useNutritionStore((s) => s.days[day] ?? EMPTY);
}

export function sumEntries(entries: readonly LogEntry[]): Macros {
  return entries.reduce((acc, e) => addMacros(acc, e.macros), ZERO_MACROS);
}

export function useDailyTotals(day: DayKey): Macros {
  const entries = useDayEntries(day);
  return useMemo(() => sumEntries(entries), [entries]);
}

export function useFoodHistory(): Record<string, FoodHistoryItem> {
  return useNutritionStore((s) => s.foods);
}

// ---------------------------------------------------------------------------
// Migrations (exported for tests)
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

export function migrateNutritionState(persisted: unknown, version: number): Partial<NutritionState> {
  const s = isRecord(persisted) ? persisted : {};
  if (version >= 2) return s as Partial<NutritionState>;

  // v0/v1 → v2.
  // - Log entries get unique ids (the barcode was reused as id, so duplicates collided).
  // - Meal names become ids ('Breakfast' → 'breakfast').
  // - knownFoods stored PORTION-scaled macros but were read back as per-100 g. Those
  //   numbers can't be un-scaled, so refs keep their identity with per100 = null and the
  //   product screen re-fetches nutrition by barcode.
  const days: Record<DayKey, LogEntry[]> = {};
  const logs = isRecord(s.logs) ? s.logs : {};
  for (const [day, log] of Object.entries(logs)) {
    if (!isRecord(log) || !Array.isArray(log.meals)) continue;
    const entries: LogEntry[] = [];
    for (const meal of log.meals) {
      if (!isRecord(meal) || !Array.isArray(meal.foods)) continue;
      const mealId = typeof meal.name === 'string' ? meal.name.toLowerCase() : 'snack';
      for (const food of meal.foods) {
        if (!isRecord(food)) continue;
        entries.push({
          id: newId(),
          meal: isMealType(mealId) ? mealId : 'snack',
          name: str(food.name) ?? '—',
          brand: str(food.brand),
          foodCode: str(food.id),
          quantity: 1,
          unit: 'portion',
          macros: {
            kcal: num(food.calories),
            protein: num(food.protein),
            carbs: num(food.carbs),
            fat: num(food.fat),
          },
          loggedAt: `${day}T12:00:00.000Z`,
        });
      }
    }
    if (entries.length > 0) days[day] = entries;
  }

  const foods: Record<string, FoodHistoryItem> = {};
  const known = isRecord(s.knownFoods) ? s.knownFoods : {};
  for (const [key, item] of Object.entries(known)) {
    if (!isRecord(item)) continue;
    const code = str(item.id) ?? key;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    foods[code] = {
      code,
      name: str(item.name) ?? '—',
      brand: str(item.brand),
      imageUrl: str(item.image_url),
      base: 'g',
      per100: null,
      source: 'off',
      lastUsed: str(item.lastUsed) ?? new Date(0).toISOString(),
      meals: tags.map((t) => String(t).toLowerCase()).filter(isMealType),
      useCount: 1,
    };
  }

  return { days, foods };
}
