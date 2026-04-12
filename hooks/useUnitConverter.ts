import { useCallback, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import {
  convertKgToLbs,
  convertLbsToKg,
  formatWeightValue,
  convertCmToFeet
} from '../utils/unitConversion';

export function useUnitConverter() {
  const units = useUserStore(s => s.units);
  const weight = useUserStore(s => s.weight);
  const height = useUserStore(s => s.height);

  const convertWeight = useCallback((valInKg: number | string) => {
    const val = typeof valInKg === 'string' ? parseFloat(valInKg) : valInKg;
    if (isNaN(val)) return { value: 0, unit: units.weight, formatted: '--' };

    const converted = units.weight === 'lbs' ? convertKgToLbs(val) : val;
    return {
      value: converted,
      unit: units.weight,
      formatted: formatWeightValue(converted)
    };
  }, [units.weight]);

  const convertHeight = useCallback((valInCm: number | string) => {
    const val = typeof valInCm === 'string' ? parseFloat(valInCm) : valInCm;
    if (isNaN(val)) return { value: 0, unit: units.height, formatted: '--' };

    if (units.height === 'cm') {
      return { value: val, unit: 'cm' as const, formatted: val.toFixed(0) };
    }
    const { text, feet } = convertCmToFeet(val);
    return { value: feet, unit: 'ft' as const, formatted: text };
  }, [units.height]);

  const currentWeight = useMemo(() => convertWeight(weight), [convertWeight, weight]);
  const currentHeight = useMemo(() => convertHeight(height), [convertHeight, height]);

  const toStorageWeight = useCallback((displayVal: number | string): string => {
    const val = typeof displayVal === 'string' ? parseFloat(displayVal) : displayVal;
    if (isNaN(val)) return '0';
    const stored = units.weight === 'lbs' ? convertLbsToKg(val) : val;
    return stored.toString();
  }, [units.weight]);

  return {
    currentWeight,
    currentHeight,
    convertWeight,
    convertHeight,
    toStorageWeight,
    units
  };
}
