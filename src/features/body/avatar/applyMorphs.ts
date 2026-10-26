import type { AvatarModel, MorphSolution, MorphName } from '@/features/body/avatar/types';

/**
 * Rest pose + Σ weight × sparse delta, then the uniform scale. Runs on the CPU once per
 * snapshot change (≈13k vertices, a few sparse targets): a few milliseconds, and it keeps
 * the renderer free of GPU morph-target limits on mobile GL.
 */
export function applyMorphs(model: AvatarModel, solution: Pick<MorphSolution, 'weights' | 'scale'>, out?: Float32Array) {
  const result = out && out.length === model.positions.length ? out : new Float32Array(model.positions.length);
  result.set(model.positions);
  for (const [name, w] of Object.entries(solution.weights)) {
    if (!w) continue;
    const morph = model.morphs[name as MorphName];
    if (!morph) continue;
    const { indices, values } = morph;
    for (let i = 0; i < indices.length; i++) {
      const v = (indices[i] ?? 0) * 3;
      result[v] = (result[v] ?? 0) + w * (values[i * 3] ?? 0);
      result[v + 1] = (result[v + 1] ?? 0) + w * (values[i * 3 + 1] ?? 0);
      result[v + 2] = (result[v + 2] ?? 0) + w * (values[i * 3 + 2] ?? 0);
    }
  }
  if (solution.scale !== 1) {
    for (let i = 0; i < result.length; i++) result[i] = (result[i] ?? 0) * solution.scale;
  }
  return result;
}
