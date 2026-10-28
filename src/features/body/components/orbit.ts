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
  /** Where the camera looks, as an offset from the middle of the body (pinch-to-point zoom). */
  focus: [number, number, number];
}

export const POLAR_MIN = 0.35; // ≈ 20° from straight above
export const POLAR_MAX = 1.95; // ≈ 112° — a little below the horizon

export function radiusLimits(heightM: number) {
  // Arms in the A-pose reach ≈ 0.47 × height from the axis; keep a margin beyond that.
  return { min: Math.max(0.9, heightM * 0.62), max: heightM * 3.2 };
}

export function createOrbit(heightM: number): OrbitState {
  return { azimuth: 0, polar: 1.42, radius: defaultRadius(heightM), heightM, focus: [0, 0, 0] };
}

const defaultRadius = (heightM: number) => heightM * 2.3;
/** The middle of the body: where the camera looks before any zoom. */
const baseY = (heightM: number) => heightM * 0.53;

/** The aim stays on the body: inside its silhouette's box, above the feet, below the head top. */
function clampFocus(focus: readonly number[], heightM: number): [number, number, number] {
  const side = heightM * 0.22;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return [
    clamp(focus[0] ?? 0, -side, side),
    clamp(focus[1] ?? 0, heightM * 0.06 - baseY(heightM), heightM * 0.96 - baseY(heightM)),
    clamp(focus[2] ?? 0, -side, side),
  ];
}

/** Look-at point. */
function targetOf(o: Pick<OrbitState, 'focus' | 'heightM'>): [number, number, number] {
  return [o.focus[0], baseY(o.heightM) + o.focus[1], o.focus[2]];
}

/** Keeps the camera this far above the floor plane. */
const FLOOR_CLEARANCE = 0.05;

export function clampOrbit(o: OrbitState): OrbitState {
  const { min, max } = radiusLimits(o.heightM);
  const radius = Math.min(max, Math.max(min, o.radius));
  const focus = clampFocus(o.focus ?? [0, 0, 0], o.heightM);
  // Never below the floor: camera y = target y + r·cos(polar) ≥ clearance.
  const floorCos = -(targetOf({ focus, heightM: o.heightM })[1] - FLOOR_CLEARANCE) / radius;
  const floorPolar = floorCos <= -1 ? Math.PI : Math.acos(floorCos);
  const polarMax = Math.min(POLAR_MAX, floorPolar);
  return { ...o, radius, focus, polar: Math.min(polarMax, Math.max(POLAR_MIN, o.polar)) };
}

export interface Viewport {
  width: number;
  height: number;
  /** Vertical field of view, degrees. */
  fov: number;
}

/**
 * Zoom to `radius` keeping the point under (x, y) — view pixels — where it is on screen:
 * the aim slides toward that point by the same fraction the distance shrinks. Zooming out
 * slides the aim back to the middle of the body, reached at the default distance.
 */
export function zoomAt(o: OrbitState, radius: number, x: number, y: number, view: Viewport): OrbitState {
  const next = clampOrbit({ ...o, radius });
  const oldR = o.radius;
  const newR = next.radius;
  if (Math.abs(newR - oldR) < 1e-9 || view.width <= 0 || view.height <= 0) return next;

  if (newR > oldR) {
    const home = defaultRadius(o.heightM);
    const t = oldR >= home ? 1 : Math.min(1, (newR - oldR) / (home - oldR));
    const keep = 1 - t;
    const focus: [number, number, number] =
      keep <= 0 ? [0, 0, 0] : [o.focus[0] * keep, o.focus[1] * keep, o.focus[2] * keep];
    return clampOrbit({ ...next, focus });
  }

  // Point under the fingers, on the plane through the aim facing the camera.
  const ndcX = (x / view.width) * 2 - 1;
  const ndcY = 1 - (y / view.height) * 2;
  const halfH = oldR * Math.tan(((view.fov / 2) * Math.PI) / 180);
  const halfW = halfH * (view.width / view.height);
  const sinP = Math.sin(o.polar);
  // Camera → aim direction, and the screen's right / up vectors.
  const fwd = [-sinP * Math.sin(o.azimuth), -Math.cos(o.polar), -sinP * Math.cos(o.azimuth)] as const;
  const rLen = Math.hypot(fwd[2], fwd[0]) || 1;
  const right = [-fwd[2] / rLen, 0, fwd[0] / rLen] as const; // fwd × worldUp
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ] as const; // right × fwd
  const k = 1 - newR / oldR;
  const shift = (i: 0 | 1 | 2) => (right[i] * ndcX * halfW + up[i] * ndcY * halfH) * k;
  return clampOrbit({
    ...next,
    focus: [o.focus[0] + shift(0), o.focus[1] + shift(1), o.focus[2] + shift(2)],
  });
}

/** Camera position + look-at target. */
export function orbitToCamera(o: OrbitState): {
  position: [number, number, number];
  target: [number, number, number];
} {
  const t = targetOf(o);
  const sinP = Math.sin(o.polar);
  return {
    position: [
      t[0] + o.radius * sinP * Math.sin(o.azimuth),
      t[1] + o.radius * Math.cos(o.polar),
      t[2] + o.radius * sinP * Math.cos(o.azimuth),
    ],
    target: t,
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
  private viewport: Viewport = { width: 0, height: 0, fov: 35 };
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

  setViewport(viewport: Viewport) {
    this.viewport = viewport;
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

  /** `focalX/Y`: midpoint between the fingers, in view pixels. */
  pinch(scale: number, focalX?: number, focalY?: number) {
    const radius = this.pinchStartRadius / Math.max(scale, 0.01);
    this.state =
      focalX === undefined || focalY === undefined
        ? clampOrbit({ ...this.state, radius })
        : zoomAt(this.state, radius, focalX, focalY, this.viewport);
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
      this.state = clampOrbit({
        ...this.state,
        azimuth: this.state.azimuth + v.az,
        polar: this.state.polar + v.po,
      });
      this.velocity = { az: v.az * OrbitController.DAMPING, po: v.po * OrbitController.DAMPING };
      this.invalidate();
    }
    return orbitToCamera(this.state);
  }
}
