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

/**
 * How much farther back to stand on a canvas narrower than the one a scene was framed for, so
 * the same width of scene stays in view on a phone. Wider canvases keep the framed distance.
 */
export function fitDistance(distance: number, aspect: number, framedAspect: number): number {
  if (!(aspect > 0) || aspect >= framedAspect) return distance;
  return distance * (framedAspect / aspect) ** 0.75;
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
