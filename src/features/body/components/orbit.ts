/**
 * Spherical camera around the body's vertical axis.
 * - azimuth: unbounded (full 360° turns)
 * - polar: from slightly above the head to slightly below the hips — never under the floor
 *   or straight down the top of the head
 * - radius: never closer than the body's reach (camera can't enter the mesh), never so far
 *   the body becomes a speck
 */
export interface OrbitState {
  azimuth: number;
  polar: number;
  radius: number;
  heightM: number;
}

export const POLAR_MIN = 0.35; // ≈ 20° from straight above
export const POLAR_MAX = 1.95; // ≈ 112° — a little below the horizon

export function radiusLimits(heightM: number) {
  // Arms in the A-pose reach ≈ 0.47 × height from the axis; keep a margin beyond that.
  return { min: Math.max(0.9, heightM * 0.62), max: heightM * 3.2 };
}

export function createOrbit(heightM: number): OrbitState {
  return { azimuth: 0, polar: 1.42, radius: heightM * 2.3, heightM };
}

/** Look-at height: hips when far, rising toward the chest when zoomed in. */
function targetY(o: Pick<OrbitState, 'radius' | 'heightM'>) {
  const { min, max } = radiusLimits(o.heightM);
  const zoom = 1 - (o.radius - min) / (max - min); // 0 far … 1 near
  return o.heightM * (0.52 + 0.14 * Math.min(1, Math.max(0, zoom)));
}

/** Keeps the camera this far above the floor plane. */
const FLOOR_CLEARANCE = 0.05;

export function clampOrbit(o: OrbitState): OrbitState {
  const { min, max } = radiusLimits(o.heightM);
  const radius = Math.min(max, Math.max(min, o.radius));
  // Never below the floor: camera y = targetY + r·cos(polar) ≥ clearance.
  const floorCos = -(targetY({ radius, heightM: o.heightM }) - FLOOR_CLEARANCE) / radius;
  const floorPolar = floorCos <= -1 ? Math.PI : Math.acos(floorCos);
  const polarMax = Math.min(POLAR_MAX, floorPolar);
  return { ...o, radius, polar: Math.min(polarMax, Math.max(POLAR_MIN, o.polar)) };
}

/** Camera position + look-at target. */
export function orbitToCamera(o: OrbitState): { position: [number, number, number]; target: [number, number, number] } {
  const ty = targetY(o);
  const sinP = Math.sin(o.polar);
  return {
    position: [
      o.radius * sinP * Math.sin(o.azimuth),
      ty + o.radius * Math.cos(o.polar),
      o.radius * sinP * Math.cos(o.azimuth),
    ],
    target: [0, ty, 0],
  };
}

/**
 * Mutable camera controller shared by the gesture handlers (JS thread) and the render loop.
 * A plain object outside React state: gestures mutate it every frame without re-rendering.
 */
export class OrbitController {
  private state: OrbitState;
  private velocity = { az: 0, po: 0 };
  private pinchStartRadius = 0;
  private invalidate: () => void = () => {};

  static readonly ROTATE_PER_PX = 0.008;
  /** Velocity kept per frame after release. */
  static readonly DAMPING = 0.9;
  private static readonly STOP_BELOW = 1e-4;

  constructor(heightM: number) {
    this.state = createOrbit(heightM);
  }

  attach(invalidate: () => void) {
    this.invalidate = invalidate;
  }

  setHeight(heightM: number) {
    if (Math.abs(heightM - this.state.heightM) < 1e-3) return;
    this.state = clampOrbit({ ...createOrbit(heightM), azimuth: this.state.azimuth });
    this.invalidate();
  }

  get current(): Readonly<OrbitState> {
    return this.state;
  }

  grab() {
    this.velocity = { az: 0, po: 0 };
  }

  rotate(dxPx: number, dyPx: number) {
    this.state = clampOrbit({
      ...this.state,
      azimuth: this.state.azimuth - dxPx * OrbitController.ROTATE_PER_PX,
      polar: this.state.polar - dyPx * OrbitController.ROTATE_PER_PX,
    });
    this.invalidate();
  }

  /** px/s at release → rad/frame (60 fps) coast. */
  release(vxPx: number, vyPx: number) {
    this.velocity = {
      az: (-vxPx * OrbitController.ROTATE_PER_PX) / 60,
      po: (-vyPx * OrbitController.ROTATE_PER_PX) / 60,
    };
    this.invalidate();
  }

  pinchStart() {
    this.pinchStartRadius = this.state.radius;
  }

  pinch(scale: number) {
    this.state = clampOrbit({ ...this.state, radius: this.pinchStartRadius / Math.max(scale, 0.01) });
    this.invalidate();
  }

  reset() {
    this.velocity = { az: 0, po: 0 };
    this.state = createOrbit(this.state.heightM);
    this.invalidate();
  }

  /** Advances the coast; returns the camera pose for this frame. */
  step() {
    const v = this.velocity;
    if (Math.abs(v.az) > OrbitController.STOP_BELOW || Math.abs(v.po) > OrbitController.STOP_BELOW) {
      this.state = clampOrbit({ ...this.state, azimuth: this.state.azimuth + v.az, polar: this.state.polar + v.po });
      this.velocity = { az: v.az * OrbitController.DAMPING, po: v.po * OrbitController.DAMPING };
      this.invalidate();
    }
    return orbitToCamera(this.state);
  }
}
