import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  type CameraPose,
  damp,
  easeInOutCubic,
  fitDistance,
  lerpPose,
  posePosition,
  rubberBand,
  spring,
} from './pose';

const a: CameraPose = { target: [0, 0, 0], distance: 10, azimuth: -0.5, elevation: 0.6 };
const b: CameraPose = { target: [0, -4, 0], distance: 8, azimuth: 0.2, elevation: 0.4 };

describe('camera poses', () => {
  it('eases in and out, from 0 to 1 and no further', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    // Slow off the mark and into place.
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });

  it('turns the short way round', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDelta(-3, 3)).toBeCloseTo(6 - 2 * Math.PI);
  });

  it('starts and ends a flight on its poses, changing distance geometrically', () => {
    expect(lerpPose(a, b, 0)).toEqual(a);
    const end = lerpPose(a, b, 1);
    expect(end.target).toEqual(b.target);
    expect(end.distance).toBeCloseTo(b.distance);
    expect(end.azimuth).toBeCloseTo(b.azimuth);
    expect(end.elevation).toBeCloseTo(b.elevation);
    const middle = lerpPose(a, b, 0.5);
    expect(middle.target[1]).toBeCloseTo(-2);
    expect(middle.distance).toBeCloseTo(Math.sqrt(10 * 8));
  });

  it('places the camera on its orbit around the target', () => {
    const [x, y, z] = posePosition({ target: [1, 2, 3], distance: 10, azimuth: 0, elevation: 0 });
    expect([x, y, z].map((n) => Number(n.toFixed(6)))).toEqual([1, 2, 13]);
    const raised = posePosition({ ...a, elevation: Math.PI / 2 });
    expect(raised[1]).toBeCloseTo(10);
    expect(Math.hypot(...posePosition(a))).toBeCloseTo(10);
  });

  it('stands farther back on a narrower canvas, never closer on a wider one', () => {
    expect(fitDistance(10, 2, 1.5)).toBe(10);
    expect(fitDistance(10, 1.5, 1.5)).toBe(10);
    expect(fitDistance(10, 1, 1.5)).toBeGreaterThan(10);
    expect(fitDistance(10, 0.8, 1.5)).toBeGreaterThan(fitDistance(10, 1, 1.5));
    expect(fitDistance(10, Number.NaN, 1.5)).toBe(10);
  });
});

describe('motion helpers', () => {
  it('springs home without overshoot, whatever the frame rate', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      let state = { value: 1, velocity: 0 };
      let lowest = 1;
      for (let t = 0; t < 2; t += dt) {
        state = spring(state.value, state.velocity, 0, dt, 6);
        lowest = Math.min(lowest, state.value);
      }
      expect(lowest).toBeGreaterThanOrEqual(0);
      expect(state.value).toBeLessThan(0.01);
    }
  });

  it('damps towards a target independently of the frame rate', () => {
    const coarse = damp(0, 1, 0.1, 0.2);
    let fine = 0;
    for (let i = 0; i < 10; i++) fine = damp(fine, 1, 0.01, 0.2);
    expect(fine).toBeCloseTo(coarse, 6);
    expect(damp(0, 1, 0.1, 0)).toBe(1);
  });

  it('resists a drag as it nears its limit, and never passes it', () => {
    expect(rubberBand(0.01, 0.6)).toBeCloseTo(0.01, 3);
    expect(rubberBand(5, 0.6)).toBeLessThan(0.6);
    expect(rubberBand(-5, 0.6)).toBeGreaterThan(-0.6);
  });
});
