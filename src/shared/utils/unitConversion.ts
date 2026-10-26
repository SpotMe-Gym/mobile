export const KG_TO_LBS = 2.20462;
export const INCH_TO_CM = 2.54;
export const OZ_TO_G = 28.3495;

export const convertKgToLbs = (kg: number): number => kg * KG_TO_LBS;
export const convertLbsToKg = (lbs: number): number => lbs / KG_TO_LBS;

/** One decimal, rounded (not floored) — 79.96 kg displays as 80.0, not 79.9. */
export const formatWeightValue = (val: number): string => (Math.round(val * 10) / 10).toFixed(1);

export const convertCmToFeet = (cm: number): { feet: number; inches: number; text: string } => {
  const totalInches = Math.round(cm / INCH_TO_CM);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches, text: `${feet}' ${inches}"` };
};

export const convertFeetToCm = (feet: number, inches: number): number => (feet * 12 + inches) * INCH_TO_CM;
