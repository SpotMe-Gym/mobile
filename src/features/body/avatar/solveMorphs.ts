import { MEASUREMENT_KEYS } from '@/features/body/measurementCatalog';
import type { BiaReport, BodySnapshot, MeasurementKey } from '@/features/body/types';
import type {
  AvatarCalibration,
  MacroName,
  MeasureMorph,
  MorphName,
  MorphSolution,
} from '@/features/body/avatar/types';

/** Measure morphs may go a little past the MPFB2 slider range before we stop chasing a value. */
export const MAX_MEASURE_WEIGHT = 1.5;
/**
 * Macro morph limits, per direction. MPFB2's weight macro is gentle (≈ ±6 kg on a 173 cm
 * body at full strength), so it may extrapolate further; logged circumferences then shape the
 * body beyond what mass alone can say.
 */
export const MAX_MACRO_WEIGHT: Record<MacroName, number> = { height: 1.3, weight: 2.0, muscle: 1.0 };
/** Ridge term: keeps unmeasured regions near the base body and splits work between morphs. */
const LAMBDA = 0.5;
const SWEEPS = 80;

/** Typical skeletal-muscle-mass / body-weight ratio at the base phenotype (BIA norms). */
const SMM_RATIO_REF = { male: 0.42, female: 0.34, neutral: 0.38 } as const;
/** Ratio difference that maps to a full muscle macro step. */
const SMM_RATIO_SPAN = 0.08;

const MEASURE_MORPHS: MeasureMorph[] = MEASUREMENT_KEYS.flatMap((k) => [`${k}_incr`, `${k}_decr`] as const);

/** Positive weight → `<macro>_up`, negative → `<macro>_down`. */
function macroWeights(name: MacroName, signed: number): Partial<Record<MorphName, number>> {
  const max = MAX_MACRO_WEIGHT[name];
  const w = Math.max(-max, Math.min(max, signed));
  return w >= 0 ? { [`macro_${name}_up`]: w } : { [`macro_${name}_down`]: -w };
}

function effect(cal: AvatarCalibration, weights: Partial<Record<MorphName, number>>, pick: 'heightCm' | 'massKg') {
  let sum = 0;
  for (const [name, w] of Object.entries(weights)) {
    if (!w) continue;
    sum += w * (cal.morphs[name as MorphName]?.[pick] ?? 0);
  }
  return sum;
}

/**
 * Signed macro weight that moves `value` from `base` to `target`, given the effect of a
 * full up / down step. Returns 0 when the morph doesn't move the value.
 */
function signedStep(base: number, target: number, up: number, down: number): number {
  const diff = target - base;
  if (diff >= 0) return up > 1e-6 ? diff / up : 0;
  return down < -1e-6 ? -(diff / down) : 0;
}

/** Muscle macro from a BIA report: more skeletal muscle per kg than the reference → up. */
export function muscleFromBia(gender: BodySnapshot['gender'], bia: BiaReport | undefined, weightKg: number): number {
  if (!bia?.skeletalMuscleKg || weightKg <= 0) return 0;
  return (bia.skeletalMuscleKg / weightKg - SMM_RATIO_REF[gender]) / SMM_RATIO_SPAN;
}

/**
 * Turns a body snapshot into morph weights for one avatar model.
 *
 * 1. Height: the MPFB2 height macro covers what it can, a uniform scale lands the exact
 *    height (so any height works, and proportions still change like MakeHuman's).
 * 2. Muscle: from BIA skeletal muscle mass when available, else neutral.
 * 3. Weight: the weight macro matches the body mass (mesh volume × density, measured at
 *    build time), after accounting for the scale.
 * 4. Circumferences: bounded least squares over the measure morphs (coordinate descent with
 *    a small ridge term) against every measurement the user has logged. Each morph's effect
 *    on every circumference is in the calibration, so couplings (e.g. the waist morph also
 *    moving the upper abdomen) are handled instead of fought.
 */
export function solveMorphs(cal: AvatarCalibration, snapshot: BodySnapshot): MorphSolution {
  const morph = (n: MorphName) => cal.morphs[n];
  const base = cal.base;

  // 1. Height
  const hUp = morph('macro_height_up')?.heightCm ?? 0;
  const hDown = morph('macro_height_down')?.heightCm ?? 0;
  const heightW = signedStep(base.heightCm, snapshot.heightCm, hUp, hDown);
  const weights: Partial<Record<MorphName, number>> = { ...macroWeights('height', heightW) };
  const morphedHeight = base.heightCm + effect(cal, weights, 'heightCm');
  const scale = morphedHeight > 0 ? snapshot.heightCm / morphedHeight : 1;

  // 2. Muscle
  Object.assign(weights, macroWeights('muscle', muscleFromBia(snapshot.gender, snapshot.composition, snapshot.weightKg)));

  // 3. Weight — mass scales with the cube of the uniform scale.
  const targetMass = snapshot.weightKg / scale ** 3;
  const massNow = base.massKg + effect(cal, weights, 'massKg');
  const wUp = morph('macro_weight_up')?.massKg ?? 0;
  const wDown = morph('macro_weight_down')?.massKg ?? 0;
  Object.assign(weights, macroWeights('weight', signedStep(massNow, targetMass, wUp, wDown)));

  // 4. Circumferences (in unscaled model cm).
  const predicted: Partial<Record<MeasurementKey, number>> = {};
  for (const key of MEASUREMENT_KEYS) {
    let v = base.measurementsCm[key] ?? 0;
    for (const [name, w] of Object.entries(weights)) {
      v += (w ?? 0) * (cal.morphs[name as MorphName]?.cm[key] ?? 0);
    }
    predicted[key] = v;
  }

  const measured = MEASUREMENT_KEYS.filter((k) => {
    const v = snapshot.measurements[k];
    return typeof v === 'number' && v > 0 && (base.measurementsCm[k] ?? 0) > 0;
  });
  if (measured.length > 0) {
    const target: Partial<Record<MeasurementKey, number>> = {};
    for (const k of measured) target[k] = (snapshot.measurements[k] ?? 0) / scale;

    const vars = MEASURE_MORPHS.filter((n) => {
      const cm = cal.morphs[n]?.cm;
      return cm && measured.some((k) => Math.abs(cm[k] ?? 0) > 0.1);
    });
    const w = new Map<MeasureMorph, number>(vars.map((n) => [n, 0]));
    const residual = new Map<MeasurementKey, number>(measured.map((k) => [k, (predicted[k] ?? 0) - (target[k] ?? 0)]));

    for (let sweep = 0; sweep < SWEEPS; sweep++) {
      let moved = 0;
      for (const n of vars) {
        const cm = cal.morphs[n]?.cm ?? {};
        let g = 0;
        let h = LAMBDA;
        for (const k of measured) {
          const j = cm[k] ?? 0;
          if (!j) continue;
          g += j * (residual.get(k) ?? 0);
          h += j * j;
        }
        const old = w.get(n) ?? 0;
        g += LAMBDA * old;
        const next = Math.max(0, Math.min(MAX_MEASURE_WEIGHT, old - g / h));
        const step = next - old;
        if (step === 0) continue;
        w.set(n, next);
        moved = Math.max(moved, Math.abs(step));
        for (const k of measured) {
          const j = cm[k] ?? 0;
          if (j) residual.set(k, (residual.get(k) ?? 0) + step * j);
        }
      }
      if (moved < 1e-4) break;
    }

    for (const [n, value] of w) {
      if (value < 1e-4) continue;
      weights[n] = value;
      const cm = cal.morphs[n]?.cm ?? {};
      for (const key of MEASUREMENT_KEYS) predicted[key] = (predicted[key] ?? 0) + value * (cm[key] ?? 0);
    }
  }

  const predictedCm: Partial<Record<MeasurementKey, number>> = {};
  for (const key of MEASUREMENT_KEYS) predictedCm[key] = (predicted[key] ?? 0) * scale;

  return {
    weights,
    scale,
    predictedCm,
    predictedKg: (base.massKg + effect(cal, weights, 'massKg')) * scale ** 3,
  };
}
