import { useUserStore } from '../store/userStore';
import {
  convertKgToLbs,
  convertLbsToKg,
  formatWeightValue,
  convertCmToFeet
} from '../utils/unitConversion';

export function useUnitConverter() {
  const { units, weight, height } = useUserStore();

  // Helper to convert arbitrary weight (for lists/history)
  const convertWeight = (valInKg: number | string) => {
    const val = typeof valInKg === 'string' ? parseFloat(valInKg) : valInKg;
    if (isNaN(val)) return { value: 0, unit: units.weight, formatted: '--' };

    const converted = units.weight === 'lbs' ? convertKgToLbs(val) : val;
    return {
      value: converted,
      unit: units.weight,
      formatted: formatWeightValue(converted)
    };
  };

  // Helper to convert arbitrary height
  const convertHeight = (valInCm: number | string) => {
    const val = typeof valInCm === 'string' ? parseFloat(valInCm) : valInCm;
    if (isNaN(val)) return { value: 0, unit: units.height, formatted: '--' };

    if (units.height === 'cm') {
      return {
        value: val,
        unit: 'cm',
        formatted: val.toFixed(0)
      };
    } else {
      const { text, feet } = convertCmToFeet(val);
      return {
        value: feet, // Approximate for graphing if needed
        unit: 'ft',
        formatted: text
      };
    }
  };

  // Pre-calculated values for current user
  const currentWeight = convertWeight(weight);
  const currentHeight = convertHeight(height);

  // Input conversion (Display -> Storage)
  const toStorageWeight = (displayVal: number | string): string => {
    const val = typeof displayVal === 'string' ? parseFloat(displayVal) : displayVal;
    if (isNaN(val)) return '0';

    // If user is in Lbs, input is Lbs, convert to Kg
    const valInKg = units.weight === 'lbs' ? convertLbsToKg(val) : val;
    return valInKg.toString(); // Store expects string
  };

  return {
    currentWeight,
    currentHeight,
    convertWeight,
    convertHeight,
    toStorageWeight,
    units
  };
}
