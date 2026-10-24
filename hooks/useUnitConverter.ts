import { useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/userStore';
import { useWeightStore, selectLatestWeight } from '@/store/weightStore';
import { convertKgToLbs, convertLbsToKg, formatWeightValue, convertCmToFeet } from '@/utils/unitConversion';

export interface DisplayValue<U extends string> {
  value: number;
  unit: U;
  formatted: string;
}

export function useUnitConverter() {
  const units = useUserStore((s) => s.units);
  const heightCm = useUserStore((s) => s.heightCm);
  const latestKg = useWeightStore((s) => selectLatestWeight(s)?.kg ?? null);

  const convertWeight = useCallback(
    (kg: number | null): DisplayValue<'kg' | 'lbs'> => {
      if (kg === null || !Number.isFinite(kg)) return { value: 0, unit: units.weight, formatted: '--' };
      const value = units.weight === 'lbs' ? convertKgToLbs(kg) : kg;
      return { value, unit: units.weight, formatted: formatWeightValue(value) };
    },
    [units.weight],
  );

  const convertHeight = useCallback(
    (cm: number | null): DisplayValue<'cm' | 'ft'> => {
      if (cm === null || !Number.isFinite(cm)) return { value: 0, unit: units.height, formatted: '--' };
      if (units.height === 'cm') return { value: cm, unit: 'cm', formatted: cm.toFixed(0) };
      const { text, feet } = convertCmToFeet(cm);
      return { value: feet, unit: 'ft', formatted: text };
    },
    [units.height],
  );

  /** Display value (in the user's unit) → kilograms for storage. */
  const toKg = useCallback(
    (display: number): number => (units.weight === 'lbs' ? convertLbsToKg(display) : display),
    [units.weight],
  );

  const currentWeight = useMemo(() => convertWeight(latestKg), [convertWeight, latestKg]);
  const currentHeight = useMemo(() => convertHeight(heightCm), [convertHeight, heightCm]);

  return { units, currentWeight, currentHeight, convertWeight, convertHeight, toKg };
}
