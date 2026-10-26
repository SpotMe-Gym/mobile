import type { AvatarGender, BodySegment, MeasurementKey } from '@/features/body/types';

/** Sparse per-vertex data: `indices[i]` gets `values[i*stride … i*stride+stride-1]`. */
export interface SparseVec3 {
  indices: Uint16Array;
  values: Float32Array;
}

export interface SparseScalar {
  indices: Uint16Array;
  weights: Float32Array;
}

/** Effect of one morph at weight 1.0 (measured at build time on the mesh). */
export interface MorphCalibration {
  cm: Partial<Record<MeasurementKey, number>>;
  heightCm: number;
  massKg: number;
}

export type MacroName = 'height' | 'weight' | 'muscle';
export type MacroMorph = `macro_${MacroName}_${'up' | 'down'}`;
export type MeasureMorph = `${MeasurementKey}_${'incr' | 'decr'}`;
export type MorphName = MacroMorph | MeasureMorph;

/** The `SPOTME_body` glTF extension written by tools/avatar/build_avatars.py. */
export interface AvatarCalibration {
  version: number;
  gender: AvatarGender;
  base: {
    heightCm: number;
    massKg: number;
    measurementsCm: Partial<Record<MeasurementKey, number>>;
  };
  morphs: Partial<Record<MorphName, MorphCalibration>>;
  parts: string[];
  segments: Record<string, BodySegment>;
}

export interface AvatarModel {
  gender: AvatarGender;
  vertexCount: number;
  /** Rest pose, metres, glTF axes (Y up, facing +Z, feet at y = 0). */
  positions: Float32Array;
  indices: Uint16Array;
  /** Body part id per vertex (index into calibration.parts). */
  parts: Uint8Array;
  morphs: Partial<Record<MorphName, SparseVec3>>;
  zones: Partial<Record<MeasurementKey, SparseScalar>>;
  calibration: AvatarCalibration;
}

/** Weights for every morph + the uniform scale that lands the exact height. */
export interface MorphSolution {
  weights: Partial<Record<MorphName, number>>;
  scale: number;
  /** Circumferences of the solved body, in cm (what the 3D body actually measures). */
  predictedCm: Partial<Record<MeasurementKey, number>>;
  /** Estimated mass of the solved body, kg. */
  predictedKg: number;
}
