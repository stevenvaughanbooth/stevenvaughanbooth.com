import {
  type BufferGeometry,
  Color,
  type Material,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  type CameraPose,
  easeInOutCubic,
  framePose,
  lerpPose,
  posePosition,
  rubberBand,
  spring,
  type Vec3,
} from './pose';
import { blueprintPalette, over, parseColor, type Rgba, themeValue, toHex } from './tokens';

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
  /** A dark ground: glows add light and shadows take the background's colour. */
  dark: boolean;
  /**
   * X-ray's blueprint is on (`data-xray` on <html>): the scene is drawn as line art on the paper,
   * in the blueprint's palette, the same in both themes. `dark` is true with it.
   */
  blueprint: boolean;
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

/**
 * How the camera sees one step: the direction it looks from, and what must be in view. The engine
 * stands it as close as it can with every point in view, centred, at the canvas's shape, so a
 * step is never cropped at any width.
 */
export interface StepView {
  /** Radians around the vertical axis (0 looks along -z, from +z), as in a pose. */
  azimuth: number;
  /** Radians above the horizon. */
  elevation: number;
  /** World points to keep in view: the step's content and its labels' anchors (see `boxCorners`). */
  fit: readonly Vec3[];
}

export interface SceneDefinition<Data> {
  /** How the camera sees each step. */
  views: readonly StepView[];
  /** Vertical field of view, in degrees. */
  fov?: number;
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

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/**
 * The site's colour tokens for the theme on show. Each is read from <html> and its light-dark()
 * half picked here: Chromium resolves light-dark() for a new color-scheme only some frames after
 * the switch, so the browser's own resolution would still give the old colours. Values this
 * parser does not know are read from the probe, as the browser resolves them. A translucent token
 * (X-ray's surfaces and lines) is laid over the background, as the page shows it. Under X-ray the
 * blueprint's own palette replaces the surfaces, lines and accents.
 */
function readTheme(probe: HTMLElement): Theme {
  const html = document.documentElement;
  const blueprint = html.hasAttribute('data-xray');
  const dark = prefersDark();
  const root = getComputedStyle(html);
  const read = (name: TokenName, index: number): Rgba => {
    const swatch = probe.children[index];
    return (
      parseColor(themeValue(root.getPropertyValue(tokens[name]), dark)) ??
      (swatch ? parseColor(getComputedStyle(swatch).color) : null) ??
      BLACK
    );
  };
  const bg = { ...read('bg', tokenNames.indexOf('bg')), a: 1 };
  const values = {} as Record<TokenName, Rgba>;
  tokenNames.forEach((name, index) => {
    values[name] = over(read(name, index), bg);
  });
  if (blueprint) Object.assign(values, blueprintPalette(bg, values.fg));
  const color = {} as Record<TokenName, Color>;
  const css = {} as Record<TokenName, string>;
  for (const name of tokenNames) {
    const { r, g, b } = values[name];
    css[name] = toHex(values[name]);
    // From sRGB to three's linear working space.
    color[name] = new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  }
  return { dark: dark || blueprint, blueprint, color, css };
}

const sameTheme = (a: Theme, b: Theme) =>
  a.dark === b.dark &&
  a.blueprint === b.blueprint &&
  (Object.keys(a.css) as TokenName[]).every((name) => a.css[name] === b.css[name]);

interface PlacedLabel {
  element: HTMLElement;
  anchor: Vector3;
  align: 'center' | 'start';
  width: number;
  height: number;
}

/**
 * Disposes everything under `root` that holds GPU resources: meshes, sprites, lines and points,
 * their materials and textures. A sprite's geometry is one module-level object three.js shares
 * between every sprite; disposing it makes each renderer let go of it (it is uploaded again on
 * next use), which matters: otherwise its listeners keep every disposed renderer, its canvas and
 * the page that held it alive across client navigations.
 */
function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const { geometry, material } = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    geometry?.dispose();
    // Instanced meshes hold their own buffers for each instance's matrix and colour.
    const instanced = object as Object3D & { isInstancedMesh?: boolean; dispose?: () => void };
    if (instanced.isInstancedMesh) instanced.dispose?.();
    const materials = material ? (Array.isArray(material) ? material : [material]) : [];
    for (const each of materials) {
      for (const value of Object.values(each)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      }
      each.dispose();
    }
  });
}

async function mountScene<Data>(
  container: HTMLElement,
  definition: SceneDefinition<Data>,
  options: MountOptions<Data>,
): Promise<SceneHandle> {
  const { views } = definition;
  const fov = definition.fov ?? 30;

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
  const camera = new PerspectiveCamera(fov, 1, 0.1, 200);
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

  // Each step's pose, framed for the canvas's current shape: cleared when it changes.
  let framed: (CameraPose | undefined)[] = [];
  function poseAt(index: number): CameraPose {
    const at = Math.min(Math.max(index, 0), views.length - 1);
    let pose = framed[at];
    if (!pose) {
      const view = views[at]!;
      const { width, height } = size;
      // A share of each half of the view kept clear, with room for the labels at the edges.
      const margin = {
        x: Math.min(0.3, 0.04 + 18 / Math.max(1, width / 2)),
        y: Math.min(0.3, 0.05 + 14 / Math.max(1, height / 2)),
      };
      pose = framePose(view.azimuth, view.elevation, view.fit, fov, width / height, margin);
      framed[at] = pose;
    }
    return pose;
  }

  // The camera: a flight from one pose to the next, plus the visitor's orbit on top.
  let step = options.step;
  let from: CameraPose | null = null;
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
    const to = poseAt(step);
    if (!flight || !from) return to;
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
    framed = [];
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
    attributeFilter: ['data-theme', 'data-xray', 'class', 'style'],
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
      const now = performance.now();
      // Where the camera is now, on its way to the step it was showing.
      const here = poseNow(now);
      step = next;
      if (reducedMotion) {
        from = null;
        flight = null;
        orbit.azimuth = orbit.elevation = 0;
      } else {
        from = here;
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
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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
