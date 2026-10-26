import type { AvatarCalibration, AvatarModel, MorphName, SparseScalar, SparseVec3 } from '@/features/body/avatar/types';
import type { MeasurementKey } from '@/features/body/types';

/**
 * Minimal reader for the avatar GLBs produced by tools/avatar/build_avatars.py: one mesh,
 * POSITION + _PART attributes, uint16 indices, sparse POSITION morph targets and the
 * `SPOTME_body` extension. Deliberately tiny (no textures, no TextDecoder — Hermes-safe).
 */

const MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

interface Accessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: 'SCALAR' | 'VEC3';
  normalized?: boolean;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
}

interface BufferView {
  byteOffset?: number;
  byteLength: number;
}

interface Gltf {
  accessors: Accessor[];
  bufferViews: BufferView[];
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices: number;
      targets: { POSITION: number }[];
      extensions?: { SPOTME_body?: AvatarCalibration & { zones: Record<string, { indices: number; weights: number }> } };
    }[];
    extras?: { targetNames?: string[] };
  }[];
}

export class AvatarFormatError extends Error {}

function asciiDecode(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

export function parseAvatarGlb(buffer: ArrayBuffer): AvatarModel {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new AvatarFormatError('Not a GLB file');
  if (view.getUint32(4, true) !== 2) throw new AvatarFormatError('Unsupported glTF version');

  let offset = 12;
  let json: Gltf | null = null;
  let binOffset = -1;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === CHUNK_JSON) json = JSON.parse(asciiDecode(new Uint8Array(buffer, start, length))) as Gltf;
    else if (type === CHUNK_BIN) binOffset = start;
    offset = start + length;
  }
  if (!json || binOffset < 0) throw new AvatarFormatError('GLB is missing its JSON or BIN chunk');
  const gltf = json;

  const viewStart = (index: number, extra = 0) => binOffset + (gltf.bufferViews[index]?.byteOffset ?? 0) + extra;
  const comps = (a: Accessor) => (a.type === 'VEC3' ? 3 : 1);

  function typed(componentType: number, start: number, length: number) {
    switch (componentType) {
      case 5126:
        return new Float32Array(buffer.slice(start, start + length * 4));
      case 5123:
        return new Uint16Array(buffer.slice(start, start + length * 2));
      case 5121:
        return new Uint8Array(buffer.slice(start, start + length));
      default:
        throw new AvatarFormatError(`Unsupported componentType ${componentType}`);
    }
  }

  function dense(index: number) {
    const a = gltf.accessors[index];
    if (!a || a.bufferView === undefined) throw new AvatarFormatError(`Accessor ${index} has no data`);
    return typed(a.componentType, viewStart(a.bufferView, a.byteOffset), a.count * comps(a));
  }

  function sparseVec3(index: number): SparseVec3 {
    const a = gltf.accessors[index];
    if (!a) throw new AvatarFormatError(`Missing accessor ${index}`);
    if (!a.sparse) return { indices: new Uint16Array(0), values: new Float32Array(0) };
    const { count, indices, values } = a.sparse;
    if (indices.componentType !== 5123) throw new AvatarFormatError('Sparse indices must be uint16');
    return {
      indices: typed(5123, viewStart(indices.bufferView, indices.byteOffset), count) as Uint16Array,
      values: typed(5126, viewStart(values.bufferView, values.byteOffset), count * 3) as Float32Array,
    };
  }

  const primitive = gltf.meshes[0]?.primitives[0];
  const ext = primitive?.extensions?.SPOTME_body;
  if (!primitive || !ext) throw new AvatarFormatError('GLB has no SPOTME_body data');
  const positionIndex = primitive.attributes.POSITION;
  const partIndex = primitive.attributes._PART;
  if (positionIndex === undefined || partIndex === undefined) throw new AvatarFormatError('Missing attributes');

  const positions = dense(positionIndex) as Float32Array;
  const names = gltf.meshes[0]?.extras?.targetNames ?? [];
  const morphs: AvatarModel['morphs'] = {};
  primitive.targets.forEach((t, i) => {
    const name = names[i];
    if (name) morphs[name as MorphName] = sparseVec3(t.POSITION);
  });

  const zones: AvatarModel['zones'] = {};
  for (const [key, z] of Object.entries(ext.zones)) {
    const raw = dense(z.weights) as Uint8Array;
    const weights = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) weights[i] = (raw[i] ?? 0) / 255;
    zones[key as MeasurementKey] = { indices: dense(z.indices) as Uint16Array, weights } satisfies SparseScalar;
  }

  const { zones: _zones, ...calibration } = ext;
  return {
    gender: calibration.gender,
    vertexCount: positions.length / 3,
    positions,
    indices: dense(primitive.indices) as Uint16Array,
    parts: dense(partIndex) as Uint8Array,
    morphs,
    zones,
    calibration,
  };
}
