import {
  clampOrbit,
  createOrbit,
  orbitToCamera,
  zoomAt,
  type OrbitState,
} from '@/features/body/components/orbit';

const view = { width: 390, height: 520, fov: 35 };
type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V): V => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Where a world point lands on screen (px), with a camera that looks at the target, up = +y. */
function project(o: OrbitState, p: V): [number, number] {
  const { position, target } = orbitToCamera(o);
  const f = norm(sub(target, position));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, position);
  const z = dot(d, f);
  const t = Math.tan(((view.fov / 2) * Math.PI) / 180);
  const ndcX = dot(d, r) / (z * t * (view.width / view.height));
  const ndcY = dot(d, u) / (z * t);
  return [((ndcX + 1) / 2) * view.width, ((1 - ndcY) / 2) * view.height];
}

/** The world point under a screen point, on the plane through the target facing the camera. */
function unproject(o: OrbitState, x: number, y: number): V {
  const { position, target } = orbitToCamera(o);
  const f = norm(sub(target, position));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const t = Math.tan(((view.fov / 2) * Math.PI) / 180) * o.radius;
  const nx = (x / view.width) * 2 - 1;
  const ny = 1 - (y / view.height) * 2;
  return [0, 1, 2].map((i) => target[i]! + r[i]! * nx * t * (view.width / view.height) + u[i]! * ny * t) as V;
}

describe('zoom toward the fingers', () => {
  const start = clampOrbit({ ...createOrbit(1.75), azimuth: 0.6, polar: 1.3 });

  it('keeps the pinched point under the fingers', () => {
    const fingers: [number, number] = [120, 140]; // upper left: the right shoulder
    const point = unproject(start, ...fingers);
    let o = start;
    for (const r of [3.6, 3.0, 2.4]) o = zoomAt(o, r, ...fingers, view); // a pinch, frame by frame
    const [x, y] = project(o, point);
    expect(x).toBeCloseTo(fingers[0], 0);
    expect(y).toBeCloseTo(fingers[1], 0);
    expect(o.focus.some((v) => Math.abs(v) > 0.05)).toBe(true);
  });

  it('pinching in the middle zooms straight in', () => {
    const o = zoomAt(start, 2.4, view.width / 2, view.height / 2, view);
    expect(o.focus.map((v) => Math.abs(v) < 1e-9)).toEqual([true, true, true]);
    expect(o.radius).toBe(2.4);
  });

  it('zooming back out returns to the middle of the body', () => {
    let o = zoomAt(start, 2.2, 60, 80, view);
    expect(o.focus.some((v) => Math.abs(v) > 0.05)).toBe(true);
    o = zoomAt(o, 1.75 * 2.3, 200, 260, view);
    expect(o.focus).toEqual([0, 0, 0]);
  });

  it('never aims off the body, even pinching at the edge of the screen', () => {
    let o = start;
    for (let r = 3.8; r > 1; r -= 0.2) o = zoomAt(o, r, 0, 0, view);
    expect(Math.abs(o.focus[0])).toBeLessThanOrEqual(1.75 * 0.22 + 1e-9);
    expect(Math.abs(o.focus[2])).toBeLessThanOrEqual(1.75 * 0.22 + 1e-9);
    expect(orbitToCamera(o).target[1]).toBeLessThanOrEqual(1.75 * 0.96 + 1e-9);
  });
});
