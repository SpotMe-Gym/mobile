import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import { parseAvatarGlb } from '@/features/body/avatar/glb';
import type { AvatarModel } from '@/features/body/avatar/types';
import type { AvatarGender } from '@/features/body/types';

/**
 * Where the base body comes from. Both implementations return the same AvatarModel (same
 * GLB format, same SPOTME_body calibration), so the viewer and solver never care which one
 * produced it.
 *
 * - BundledAvatarGenerator: the three MPFB2 models shipped in assets/avatar (built by
 *   tools/avatar/build_avatars.py). Offline, instant, nothing leaves the device. Default.
 * - RemoteAvatarGenerator: the optional MPFB2 service (tools/avatar/service) that builds a
 *   model for one person's phenotype. Results are cached on disk.
 */
export interface AvatarRequest {
  gender: AvatarGender;
  heightCm?: number;
  weightKg?: number;
}

export interface AvatarGenerator {
  readonly id: string;
  load(request: AvatarRequest): Promise<AvatarModel>;
}

/* eslint-disable @typescript-eslint/no-require-imports */
const BUNDLED: Record<AvatarGender, number> = {
  male: require('../../../../assets/avatar/male.glb'),
  female: require('../../../../assets/avatar/female.glb'),
  neutral: require('../../../../assets/avatar/neutral.glb'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

async function readAsset(moduleId: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return new File(uri).arrayBuffer();
}

export class BundledAvatarGenerator implements AvatarGenerator {
  readonly id = 'bundled';
  private cache = new Map<AvatarGender, Promise<AvatarModel>>();

  load({ gender }: AvatarRequest): Promise<AvatarModel> {
    let pending = this.cache.get(gender);
    if (!pending) {
      pending = readAsset(BUNDLED[gender]).then(parseAvatarGlb);
      pending.catch(() => this.cache.delete(gender));
      this.cache.set(gender, pending);
    }
    return pending;
  }
}

/**
 * Talks to tools/avatar/service: `POST {baseUrl}/avatar` with the request JSON returns a GLB.
 * Falls back to `fallback` when offline or the service fails, so the screen always renders.
 */
export class RemoteAvatarGenerator implements AvatarGenerator {
  readonly id = 'remote';

  constructor(
    private readonly baseUrl: string,
    private readonly fallback: AvatarGenerator = new BundledAvatarGenerator(),
  ) {}

  async load(request: AvatarRequest): Promise<AvatarModel> {
    const key = `${request.gender}-${Math.round(request.heightCm ?? 0)}-${Math.round(request.weightKg ?? 0)}`;
    const cached = new File(Paths.cache, `avatar-${key}.glb`);
    try {
      if (cached.exists) return parseAvatarGlb(await cached.arrayBuffer());
      const res = await fetch(`${this.baseUrl}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`Avatar service ${res.status}`);
      const buffer = await res.arrayBuffer();
      const model = parseAvatarGlb(buffer);
      cached.write(new Uint8Array(buffer));
      return model;
    } catch {
      return this.fallback.load(request);
    }
  }
}

/** The generator the app uses. Swap for `new RemoteAvatarGenerator(url)` once a service runs. */
export const avatarGenerator: AvatarGenerator = new BundledAvatarGenerator();
