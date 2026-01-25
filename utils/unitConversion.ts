
export const KG_TO_LBS = 2.20462;
export const INCH_TO_CM = 2.54;

export const convertKgToLbs = (kg: number): number => {
  return kg * KG_TO_LBS;
};

export const convertLbsToKg = (lbs: number): number => {
  return lbs / KG_TO_LBS;
};

// Formats weight to 1 decimal place (truncated/floored)
export const formatWeightValue = (val: number): string => {
  return (Math.floor(val * 10) / 10).toFixed(1);
};

export const convertCmToFeet = (cm: number): { feet: number; inches: number; text: string } => {
  const totalInches = cm / INCH_TO_CM;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return {
    feet,
    inches,
    text: `${feet}' ${inches}"`
  };
};

export const convertFeetToCm = (feet: number, inches: number): number => {
  const totalInches = (feet * 12) + inches;
  return totalInches * INCH_TO_CM;
};
