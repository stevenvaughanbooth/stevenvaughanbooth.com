/*
 * Camera math for the 3D scenes, free of Three.js so it can be unit-tested and reasoned about on
 * its own. A pose orbits a target: the camera sits `distance` away, turned `azimuth` radians
 * around the vertical axis (0 looks along -z, from +z) and raised `elevation` radians above the
 * horizon.
 */

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  target: Vec3;
  distance: number;
  azimuth: number;
  elevation: number;
}

/** Ease in and out: slow off the mark, slow into place. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The angle from `a` to `b` the short way round, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  const d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) return d - 2 * Math.PI;
  if (d <= -Math.PI) return d + 2 * Math.PI;
  return d;
}

/**
 * The pose `t` of the way from `a` to `b`. Angles turn the short way and distance changes
 * geometrically, so a flight sweeps around and down the scene instead of cutting through it.
 */
export function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    target: [
      lerp(a.target[0], b.target[0], t),
      lerp(a.target[1], b.target[1], t),
      lerp(a.target[2], b.target[2], t),
    ],
    distance: a.distance * (b.distance / a.distance) ** t,
    azimuth: a.azimuth + angleDelta(a.azimuth, b.azimuth) * t,
    elevation: lerp(a.elevation, b.elevation, t),
  };
}

/** Where the camera sits for a pose. */
export function posePosition({ target, distance, azimuth, elevation }: CameraPose): Vec3 {
  const ground = distance * Math.cos(elevation);
  return [
    target[0] + ground * Math.sin(azimuth),
    target[1] + distance * Math.sin(elevation),
    target[2] + ground * Math.cos(azimuth),
  ];
}

/** The eight corners of the box between `min` and `max`. */
export function boxCorners(min: Vec3, max: Vec3): Vec3[] {
  const corners: Vec3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z]);
  return corners;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The camera's offset along one axis that puts as much room either side of `points` (each an
 * offset and a depth in front of the camera), by bisection between two bounds that contain it.
 */
function centre(points: readonly (readonly [number, number])[], low: number, high: number) {
  const balance = (offset: number) => {
    let most = -Infinity;
    let least = Infinity;
    for (const [value, depth] of points) {
      const seen = (value - offset) / Math.max(depth, 1e-6);
      most = Math.max(most, seen);
      least = Math.min(least, seen);
    }
    return most + least;
  };
  let a = Math.min(low, high);
  let b = Math.max(low, high);
  for (let i = 0; i < 40; i++) {
    const middle = (a + b) / 2;
    if (balance(middle) > 0) a = middle;
    else b = middle;
  }
  return (a + b) / 2;
}

/**
 * The pose that looks from `azimuth` and `elevation` and keeps every one of `points` in view at
 * the canvas's `aspect`, centred, as close as it can stand: `margin` is the share of each half of
 * the view (x across, y up) kept clear at the edges. A perspective camera with a fixed direction
 * fits a set of points exactly: each side of the view bounds how close it may come, and the
 * tighter of the two (across or up) decides.
 */
export function framePose(
  azimuth: number,
  elevation: number,
  points: readonly Vec3[],
  fov: number,
  aspect: number,
  margin: { x: number; y: number },
): CameraPose {
  // Back towards the camera, then the camera's right and up.
  const back: Vec3 = [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
  const level = Math.hypot(back[0], back[2]) || 1;
  const right: Vec3 = [back[2] / level, 0, -back[0] / level];
  const up: Vec3 = [
    back[1] * right[2] - back[2] * right[1],
    back[2] * right[0] - back[0] * right[2],
    back[0] * right[1] - back[1] * right[0],
  ];
  const forward: Vec3 = [-back[0], -back[1], -back[2]];
  const tanUp = Math.tan((fov * Math.PI) / 360) * (1 - margin.y);
  const tanAcross = Math.tan((fov * Math.PI) / 360) * aspect * (1 - margin.x);

  // A point at depth g is in view across while |a - right of camera| ≤ tan · (g - depth of camera).
  let leftmost = -Infinity;
  let rightmost = Infinity;
  let lowest = -Infinity;
  let highest = Infinity;
  let depth = 0;
  for (const point of points) {
    const a = dot(point, right);
    const e = dot(point, up);
    const g = dot(point, forward);
    leftmost = Math.max(leftmost, a - tanAcross * g);
    rightmost = Math.min(rightmost, a + tanAcross * g);
    lowest = Math.max(lowest, e - tanUp * g);
    highest = Math.min(highest, e + tanUp * g);
    depth += g / points.length;
  }
  const along = Math.min(
    (rightmost - leftmost) / (2 * tanAcross),
    (highest - lowest) / (2 * tanUp),
  );
  // Then, on the side with room to spare, centre the points in the view itself.
  const projected = points.map((point) => ({
    a: dot(point, right),
    e: dot(point, up),
    depth: dot(point, forward) - along,
  }));
  const across = centre(
    projected.map(({ a, depth }) => [a, depth] as const),
    leftmost,
    rightmost,
  );
  const lift = centre(
    projected.map(({ e, depth }) => [e, depth] as const),
    lowest,
    highest,
  );
  const camera = [0, 1, 2].map(
    (i) => across * right[i]! + lift * up[i]! + along * forward[i]!,
  ) as unknown as Vec3;
  const distance = Math.max(0.1, depth - along);
  return {
    target: [
      camera[0] + distance * forward[0],
      camera[1] + distance * forward[1],
      camera[2] + distance * forward[2],
    ],
    distance,
    azimuth,
    elevation,
  };
}

/**
 * One step of a critically damped spring towards `target`: the exact solution over `dt` seconds,
 * so it settles without overshoot at any frame rate. `omega` sets the speed (about 4 / seconds
 * to settle).
 */
export function spring(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  omega: number,
): { value: number; velocity: number } {
  const decay = Math.exp(-omega * dt);
  const offset = value - target;
  const temp = (velocity + omega * offset) * dt;
  return {
    value: target + (offset + temp) * decay,
    velocity: (velocity - omega * temp) * decay,
  };
}

/** Frame-rate independent smoothing of `value` towards `target`, with time constant `tau` seconds. */
export function damp(value: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  return target + (value - target) * Math.exp(-dt / tau);
}

/** A soft limit: about `x` near zero, never past ±`limit`, so a drag resists as it nears the edge. */
export function rubberBand(x: number, limit: number): number {
  return limit * Math.tanh(x / limit);
}
