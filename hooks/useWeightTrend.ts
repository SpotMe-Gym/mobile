import { useUserStore } from '@/store/userStore';
import { useWeightStore, selectLatestWeight, selectPreviousWeight } from '@/store/weightStore';
import { isWeightChangeFavourable } from '@/utils/nutrition';
import { useUnitConverter } from './useUnitConverter';

export interface WeightTrend {
  hasTrend: boolean;
  /** Change since the previous entry, in the display unit. */
  diff: number;
  /** true = toward the goal, false = away from it, null = neutral (maintain / no goal / no change). */
  favourable: boolean | null;
  unit: 'kg' | 'lbs';
}

export function useWeightTrend(): WeightTrend {
  const latest = useWeightStore(selectLatestWeight);
  const previous = useWeightStore(selectPreviousWeight);
  const goal = useUserStore((s) => s.goal);
  const { convertWeight, units } = useUnitConverter();

  if (!latest || !previous) return { hasTrend: false, diff: 0, favourable: null, unit: units.weight };
  const diffKg = latest.kg - previous.kg;
  const diff = convertWeight(latest.kg).value - convertWeight(previous.kg).value;
  const rounded = Math.round(diff * 10) / 10;
  return {
    hasTrend: rounded !== 0,
    diff: rounded,
    favourable: isWeightChangeFavourable(diffKg, goal),
    unit: units.weight,
  };
}
