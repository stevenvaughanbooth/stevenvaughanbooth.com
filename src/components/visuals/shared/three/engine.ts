import {
  Color,
  type Material,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  Scene,
  type Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  type CameraPose,
  easeInOutCubic,
  fitDistance,
  lerpPose,
  posePosition,
  rubberBand,
  spring,
} from './pose';
import { themeValue } from './tokens';

/*
 * The 3D engine every diagram's scene runs on. It owns the WebGL renderer and everything around
 * it: sizing and pixel ratio, drawing only while something moves, pausing off screen and in a
 * hidden tab, a lost and restored context, the site's colour tokens as live theme colours, camera
 * flights between step poses, drag to orbit with spring-back, DOM labels that follow 3D points,
 * and disposal. A scene only builds its objects and says how each step looks.
 *
 * This module and three.js load together, on demand, from a scene's chunk: nothing in the
 * initial page imports it. See ../README.md for the pattern.
 */

/** The site's colour tokens a scene can use, as CSS custom properties. */
const tokens = {
  bg: '--bg',
  surface: '--surface',
  elevated: '--elevated',
  line: '--line',
  lineStrong: '--line-strong',
  fg: '--fg',
  muted: '--muted',
  subtle: '--subtle',
  green: '--green',
  amber: '--amber',
  lilac: '--lilac',
  blue: '--blue',
} as const;

export type TokenName = keyof typeof tokens;

/** The theme on show, read from the page's CSS: colours in three's working (linear) space. */
export interface Theme {
  dark: boolean;
  color: Readonly<Record<TokenName, Color>>;
  /** The same colours as CSS strings, for comparing themes. */
  css: Readonly<Record<TokenName, string>>;
}

/** How long a camera flight between two steps takes. */
export const FLIGHT_MS = 900;

/** Drag to orbit: radians per CSS pixel, and how far from the step's pose a drag can turn. */
const ORBIT = { speed: 0.007, azimuth: 0.6, elevation: 0.22 };
/** After a drag: how long it coasts, how long it holds, and how quickly it springs back. */
const RELEASE = { coastMs: 450, holdMs: 1400, omega: 6 };

export interface LabelOptions {
  /** Where the label sits on its anchor: centred on it, or starting at it. */
  align?: 'center' | 'start';
  className?: string;
}

/** What a scene's `build` receives. */
export interface SceneContext {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Whether motion is reduced: animate nothing a step changes, cut to it instead. */
  readonly reducedMotion: boolean;
  /** Draw a frame soon; frames continue while `update` reports movement. */
  invalidate(): void;
  /**
   * A DOM label that follows `anchor`, crisp at any zoom. Labels are aria-hidden with the
   * canvas: the card's own text says what they say. Set its opacity and classes as steps change.
   */
  label(text: string, anchor: Vector3, options?: LabelOptions): HTMLElement;
  /** Disposes `resource` with the scene, for textures and geometries not attached to a mesh. */
  own<T extends { dispose(): void }>(resource: T): T;
}

/** What a scene's `build` returns. */
export interface SceneParts {
  /** Show step `index`; `instant` under reduced motion and for the first frame. */
  step(index: number, instant: boolean): void;
  /** Recolour from the theme's tokens: after building, and whenever the theme changes. */
  theme(theme: Theme): void;
  /** Called every frame with the seconds since the last. Return true while still moving. */
  update?(dt: number, now: number): boolean;
}

export interface SceneDefinition<Data> {
  /** The camera's pose for each step. */
  poses: readonly CameraPose[];
  /** Vertical field of view, in degrees. */
  fov?: number;
  /** The canvas aspect ratio the poses were framed for; narrower canvases pull back to fit. */
  framedAspect?: number;
  build(context: SceneContext, data: Data): SceneParts;
}

export interface MountOptions<Data> {
  data: Data;
  step: number;
  reducedMotion: boolean;
  /** True once the first frame is drawn; false if the context is lost; true again on restore. */
  onLive(live: boolean): void;
}

export interface SceneHandle {
  setStep(step: number): void;
  setReducedMotion(reduce: boolean): void;
  dispose(): void;
}

/** A scene module's export: mounts the scene into a container the card provides. */
export interface SceneModule<Data> {
  mount(container: HTMLElement, options: MountOptions<Data>): Promise<SceneHandle>;
}

/** Declares a scene. Its module is what a diagram's controller imports on demand. */
export function defineScene<Data>(definition: SceneDefinition<Data>): SceneModule<Data> {
  return { mount: (container, options) => mountScene(container, definition, options) };
}

const tokenNames = Object.keys(tokens) as TokenName[];

/**
 * Whether the dark theme is on show, as globals.css decides it: the toggle's data-theme on
 * <html>, or else the system preference.
 */
function prefersDark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'dark' || chosen === 'light') return chosen === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Hidden swatches, one per token, inside the scene's box: the fallback for a token whose value
 * is not a plain light-dark() pair, read as the browser resolves it.
 */
function tokenProbe(): HTMLElement {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden';
  for (const name of tokenNames) {
    const swatch = document.createElement('span');
    swatch.style.color = `var(${tokens[name]})`;
    probe.append(swatch);
  }
  return probe;
}

/**
 * The site's colour tokens for the theme on show. Each is read from <html> and its light-dark()
 * half picked here: Chromium resolves light-dark() for a new color-scheme only some frames after
 * the switch, so the browser's own resolution would still give the old colours.
 */
function readTheme(probe: HTMLElement): Theme {
  const dark = prefersDark();
  const root = getComputedStyle(document.documentElement);
  const color = {} as Record<TokenName, Color>;
  const css = {} as Record<TokenName, string>;
  tokenNames.forEach((name, index) => {
    let value = themeValue(root.getPropertyValue(tokens[name]), dark);
    if (!/^#[\da-f]{3,8}$/i.test(value)) {
      const swatch = probe.children[index];
      value = swatch ? getComputedStyle(swatch).color : '#000';
    }
    css[name] = value;
    // Color parses an sRGB value and converts it to the linear working space.
    color[name] = new Color(value);
  });
  return { dark, color, css };
}

const sameTheme = (a: Theme, b: Theme) =>
  a.dark === b.dark &&
  (Object.keys(a.css) as TokenName[]).every((name) => a.css[name] === b.css[name]);

interface PlacedLabel {
  element: HTMLElement;
  anchor: Vector3;
  align: 'center' | 'start';
  width: number;
  height: number;
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}

async function mountScene<Data>(
  container: HTMLElement,
  definition: SceneDefinition<Data>,
  options: MountOptions<Data>,
): Promise<SceneHandle> {
  const { poses } = definition;
  const poseAt = (index: number) => poses[Math.min(Math.max(index, 0), poses.length - 1)]!;

  const canvas = document.createElement('canvas');
  // Vertical swipes still scroll the page on touch screens; a sideways drag orbits.
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y pinch-zoom';
  canvas.className = 'cursor-grab active:cursor-grabbing';
  const layer = document.createElement('div');
  layer.className = 'pointer-events-none absolute inset-0 select-none';
  const probe = tokenProbe();
  container.append(canvas, layer, probe);

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch (error) {
    canvas.remove();
    layer.remove();
    probe.remove();
    throw error;
  }
  // Shader errors are a development concern; checking them stalls on every program link.
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
  // A software renderer (no GPU, or a blocked one) draws a frame in tens of milliseconds: there the
  // scene draws at 1x and cuts between steps, as under reduced motion, instead of flying.
  const software = isSoftwareRenderer(renderer);
  renderer.setPixelRatio(software ? 1 : Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(definition.fov ?? 30, 1, 0.1, 200);
  const owned: { dispose(): void }[] = [];
  const labels: PlacedLabel[] = [];
  let reducedMotion = options.reducedMotion || software;
  let theme = readTheme(probe);
  let size = { width: 0, height: 0 };

  let frame = 0;
  let lastFrame = 0;
  let disposed = false;
  let lost = false;
  let live = false;
  let onScreen = true;
  let ready = false;

  const context: SceneContext = {
    scene,
    camera,
    get reducedMotion() {
      return reducedMotion;
    },
    invalidate,
    label(text, anchor, { align = 'center', className = '' } = {}) {
      const element = document.createElement('span');
      element.textContent = text;
      // Labels keep to one line unless their classes say otherwise.
      const wrap = className.includes('whitespace-') ? '' : 'whitespace-nowrap';
      element.className = `absolute top-0 left-0 will-change-transform ${wrap} ${className}`;
      layer.append(element);
      labels.push({ element, anchor, align, width: 0, height: 0 });
      return element;
    },
    own(resource) {
      owned.push(resource);
      return resource;
    },
  };

  let parts: SceneParts;
  try {
    parts = definition.build(context, options.data);
    parts.theme(theme);
  } catch (error) {
    // A scene that fails to build leaves nothing behind: the 2D card stays.
    disposeObject(scene);
    for (const resource of owned) resource.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    layer.remove();
    probe.remove();
    throw error;
  }

  // The camera: a flight from one pose to the next, plus the visitor's orbit on top.
  let step = options.step;
  let from = poseAt(step);
  let to = from;
  let flight: { start: number; duration: number } | null = null;
  parts.step(step, true);

  // The orbit is kept unbounded and shown through a rubber band, so a drag resists near its edge.
  const orbit = { azimuth: 0, elevation: 0, va: 0, ve: 0, released: 0 };
  let drag: { id: number; x: number; y: number; t: number; touch: boolean } | null = null;
  let holdTimer = 0;
  const orbitView = () => ({
    azimuth: rubberBand(orbit.azimuth, ORBIT.azimuth),
    elevation: rubberBand(orbit.elevation, ORBIT.elevation),
  });

  function poseNow(now: number): CameraPose {
    if (!flight) return to;
    const t = (now - flight.start) / flight.duration;
    if (t >= 1) {
      flight = null;
      return to;
    }
    return lerpPose(from, to, easeInOutCubic(t));
  }

  /** Moves the orbit on after a drag: it coasts, holds, then springs home. True while moving. */
  function updateOrbit(dt: number, now: number): boolean {
    if (drag || reducedMotion || (orbit.azimuth === 0 && orbit.elevation === 0)) return false;
    const since = now - orbit.released;
    if (since < RELEASE.coastMs) {
      orbit.azimuth = clamp(orbit.azimuth + orbit.va * dt, 2 * ORBIT.azimuth);
      orbit.elevation = clamp(orbit.elevation + orbit.ve * dt, 2 * ORBIT.elevation);
      const friction = Math.exp(-dt / 0.16);
      orbit.va *= friction;
      orbit.ve *= friction;
      return true;
    }
    if (since < RELEASE.coastMs + RELEASE.holdMs) {
      // Hold still, drawing nothing, then wake to spring back.
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(invalidate, RELEASE.coastMs + RELEASE.holdMs - since);
      return false;
    }
    orbit.azimuth = spring(orbit.azimuth, 0, 0, dt, RELEASE.omega).value;
    orbit.elevation = spring(orbit.elevation, 0, 0, dt, RELEASE.omega).value;
    if (Math.abs(orbit.azimuth) < 1e-4 && Math.abs(orbit.elevation) < 1e-4) {
      orbit.azimuth = orbit.elevation = 0;
      return false;
    }
    return true;
  }

  const projected = new Vector3();
  function placeLabels() {
    const { width, height } = size;
    for (const label of labels) {
      projected.copy(label.anchor).project(camera);
      const outside =
        projected.z > 1 || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15;
      label.element.style.visibility = outside ? 'hidden' : '';
      if (outside) continue;
      if (!label.width) {
        label.width = label.element.offsetWidth;
        label.height = label.element.offsetHeight;
      }
      const x = ((projected.x + 1) / 2) * width - (label.align === 'center' ? label.width / 2 : 0);
      const y = ((1 - projected.y) / 2) * height - label.height / 2;
      // Whole pixels keep the text crisp.
      label.element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  /** Draws one frame; true if something is still moving. */
  function draw(now: number, dt: number): boolean {
    const pose = poseNow(now);
    const orbiting = updateOrbit(dt, now);
    const turned = orbitView();
    const view = {
      ...pose,
      distance: fitDistance(
        pose.distance,
        size.width / size.height,
        definition.framedAspect ?? 1.5,
      ),
      azimuth: pose.azimuth + turned.azimuth,
      elevation: Math.min(1.45, Math.max(0.05, pose.elevation + turned.elevation)),
    };
    camera.position.set(...posePosition(view));
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    const moving = parts.update?.(dt, now) ?? false;
    renderer.render(scene, camera);
    placeLabels();
    if (!live) {
      live = true;
      options.onLive(true);
    }
    return flight !== null || orbiting || moving;
  }

  function canDraw() {
    return ready && !disposed && !lost && onScreen && document.visibilityState !== 'hidden';
  }

  function invalidate() {
    if (frame || !canDraw()) return;
    frame = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    frame = 0;
    if (!canDraw()) {
      lastFrame = 0;
      return;
    }
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    if (draw(now, dt)) invalidate();
    else lastFrame = 0;
  }

  /** Draws at once, outside the frame loop: a theme switch must be in the next snapshot. */
  function drawNow() {
    if (!canDraw()) return;
    draw(performance.now(), 0);
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    if (width === size.width && height === size.height) return;
    size = { width, height };
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const label of labels) label.width = 0;
    invalidate();
  }

  function retheme() {
    if (disposed) return;
    const next = readTheme(probe);
    if (sameTheme(next, theme)) return;
    theme = next;
    parts.theme(theme);
    for (const label of labels) label.width = 0;
    drawNow();
  }

  // Drag to orbit. The tour holds while a pointer is pressed in its region, so a drag pauses it.
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      touch: event.pointerType === 'touch',
    };
    orbit.va = orbit.ve = 0;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    // On touch screens only the sideways part orbits: up and down belong to the page.
    const dy = drag.touch ? 0 : event.clientY - drag.y;
    const dt = Math.max(1, event.timeStamp - drag.t) / 1000;
    // Past twice the limit the band is flat: keep it there, so it springs home promptly.
    orbit.azimuth = clamp(orbit.azimuth - dx * ORBIT.speed, 2 * ORBIT.azimuth);
    orbit.elevation = clamp(orbit.elevation + dy * ORBIT.speed, 2 * ORBIT.elevation);
    orbit.va = (-dx * ORBIT.speed) / dt;
    orbit.ve = (dy * ORBIT.speed) / dt;
    drag = { ...drag, x: event.clientX, y: event.clientY, t: event.timeStamp };
    invalidate();
  }

  function onPointerUp(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    // Under reduced motion the view stays where it was left until the next step.
    if (reducedMotion) orbit.va = orbit.ve = 0;
    orbit.released = performance.now();
    invalidate();
  }

  function onContextLost() {
    lost = true;
    live = false;
    options.onLive(false);
  }

  function onContextRestored() {
    lost = false;
    parts.theme(theme);
    invalidate();
  }

  function onVisibility() {
    invalidate();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibility);

  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  const watcher = new IntersectionObserver(
    (entries) => {
      onScreen = entries.at(-1)?.isIntersecting ?? onScreen;
      invalidate();
    },
    { rootMargin: '100px 0px' },
  );
  watcher.observe(container);
  const themeObserver = new MutationObserver(retheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  });
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener('change', retheme);

  resize();
  // Compile every shader before the first frame, off the main thread where the GPU allows, so
  // the scene never stalls as it appears.
  await renderer.compileAsync(scene, camera);
  ready = true;
  if (!disposed) invalidate();

  return {
    setStep(next) {
      if (next === step) return;
      step = next;
      const now = performance.now();
      if (reducedMotion) {
        to = poseAt(step);
        flight = null;
        orbit.azimuth = orbit.elevation = 0;
      } else {
        from = poseNow(now);
        to = poseAt(step);
        flight = { start: now, duration: FLIGHT_MS };
        // The visitor's orbit springs home with the flight.
        orbit.released = now - RELEASE.coastMs - RELEASE.holdMs;
      }
      parts.step(step, reducedMotion);
      invalidate();
    },
    setReducedMotion(reduce) {
      reducedMotion = reduce || software;
      if (reduce) flight = null;
      invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(holdTimer);
      resizer.disconnect();
      watcher.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener('change', retheme);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      disposeObject(scene);
      for (const resource of owned) resource.dispose();
      renderer.dispose();
      // Release the context now rather than at garbage collection: browsers cap live contexts.
      renderer.forceContextLoss();
      canvas.remove();
      layer.remove();
      probe.remove();
    },
  };
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/** SwiftShader, llvmpipe and the like: WebGL drawn on the CPU. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

/** Whether this context draws without a GPU, from the renderer string the browser exposes. */
export function isSoftwareRenderer(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name: unknown = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    return typeof name === 'string' && SOFTWARE_RENDERER.test(name);
  } catch {
    return false;
  }
}
