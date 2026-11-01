import {
  AdditiveBlending,
  type Blending,
  type Color,
  DirectionalLight,
  HemisphereLight,
  type Mesh,
  NormalBlending,
  type Object3D,
  type TubeGeometry,
} from 'three';
import type { SceneContext, Theme } from './engine';
import { damp } from './pose';
import { radialTexture } from './shapes';

/*
 * What every scene builds with, beyond the engine: a number that eases to its target, colour
 * mixing, the one light rig, the glow and shadow textures, and strokes that draw in along a tube.
 */

/** A number that eases towards its target, optionally after a delay. */
export class Eased {
  value: number;
  target: number;
  private from = 0;
  constructor(value: number) {
    this.value = value;
    this.target = value;
  }
  /** Eases to `target` from time `at` (ms, performance.now()), or jumps there if `instant`. */
  set(target: number, instant: boolean, at = 0) {
    this.target = target;
    this.from = at;
    if (instant) this.value = target;
  }
  /** True while it still moves. */
  update(dt: number, now: number, tau = 0.24): boolean {
    if (now < this.from) return true;
    this.value = damp(this.value, this.target, dt, tau);
    if (Math.abs(this.value - this.target) < 0.002) this.value = this.target;
    return this.value !== this.target;
  }
}

/** `a` mixed `t` of the way to `b`, into `out`. */
export const mix = (a: Color, b: Color, t: number, out: Color) => out.copy(a).lerp(b, t);

/** Glows add light on a dark ground, and are laid over a light one. */
export const glowBlending = (theme: Theme): Blending =>
  theme.dark ? AdditiveBlending : NormalBlending;

interface Intensities {
  sky: number;
  sun: number;
}

/**
 * The light every scene uses: a sky from above, the page's background colour from below, and
 * one sun above and in front. Dark themes take less of both, so glass stays glass.
 */
export function lightRig(
  root: Object3D,
  sunAt: readonly [number, number, number],
  { light, dark }: { light: Intensities; dark: Intensities },
) {
  const sky = new HemisphereLight(0xffffff, 0x000000, light.sky);
  const sun = new DirectionalLight(0xffffff, light.sun);
  sun.position.set(...sunAt);
  root.add(sky, sun);
  return {
    /** Lights the scene for `theme`. */
    paint(theme: Theme) {
      const level = theme.dark ? dark : light;
      sky.groundColor.copy(theme.color.bg);
      sky.intensity = level.sky;
      sun.intensity = level.sun;
    },
  };
}

/** The soft radial textures for glows (added or laid over) and contact shadows, owned by the scene. */
export function glowTextures(own: SceneContext['own']) {
  return { glow: own(radialTexture(2.4)), shadow: own(radialTexture(1.6)) };
}

/** Draws `drawn` (0 to 1) of each tube from its start: a stroke and its glow, drawing in. */
export function drawTubes(drawn: number, ...tubes: Mesh<TubeGeometry>[]) {
  for (const tube of tubes) {
    const { tubularSegments, radialSegments } = tube.geometry.parameters;
    tube.geometry.setDrawRange(0, Math.round(drawn * tubularSegments) * radialSegments * 6);
  }
}
