import { whenSettled } from '@/components/film/autoplay';

/*
 * Whether a diagram may draw in 3D, and when. Checked in the browser before any Three.js code is
 * fetched, so a device that opts out, or cannot draw, never downloads it and keeps the 2D card.
 */

/** Why a diagram stays 2D. */
export type SceneOptOut = 'save-data' | 'reduced-data' | 'low-memory' | 'no-webgl' | 'software-gl';

/** The Network Information API and Device Memory, where the browser has them (Chromium). */
interface NavigatorHints {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

/** WebGL 2 can be created here: three.js needs it. Probed once a page, then released. */
let webgl2: boolean | undefined;
/** The probe's context draws on the CPU (SwiftShader, llvmpipe): no GPU, or a blocked one. */
let software = false;

/** Renderer strings of WebGL drawn without a GPU. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

function rendererName(context: WebGL2RenderingContext): string {
  try {
    const info = context.getExtension('WEBGL_debug_renderer_info');
    const name: unknown = context.getParameter(
      info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER,
    );
    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

function hasWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2;
  webgl2 = false;
  if (typeof WebGL2RenderingContext === 'undefined') return webgl2;
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    webgl2 = context !== null;
    if (context) software = SOFTWARE_RENDERER.test(rendererName(context));
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // A blocked or crashed GPU process can throw: stay 2D.
  }
  return webgl2;
}

/**
 * `localStorage.scene = 'force'` draws scenes on a software renderer too: the end-to-end tests run
 * on SwiftShader and set it, to check the scenes themselves.
 */
function forced(): boolean {
  try {
    return localStorage.getItem('scene') === 'force';
  } catch {
    return false;
  }
}

/**
 * Null when the diagram may draw in 3D, otherwise the reason it stays 2D: Save-Data,
 * `prefers-reduced-data`, under 4 GB of device memory (where the browser reports it), no WebGL 2,
 * or WebGL drawn in software, where compiling a scene's shaders blocks the page for hundreds of
 * milliseconds. Reduced motion is not a reason: the scene then holds still and cuts between steps.
 */
export function sceneOptOut(): SceneOptOut | null {
  const hints = navigator as Navigator & NavigatorHints;
  if (hints.connection?.saveData) return 'save-data';
  if (window.matchMedia('(prefers-reduced-data: reduce)').matches) return 'reduced-data';
  if (typeof hints.deviceMemory === 'number' && hints.deviceMemory < 4) return 'low-memory';
  if (!hasWebGL2()) return 'no-webgl';
  if (software && !forced()) return 'software-gl';
  return null;
}

/** Forgets the WebGL probe, for tests. */
export function resetSceneSupport() {
  webgl2 = undefined;
  software = false;
}

/** How long the page must go without scrolling before a scene is built. */
const STILL_MS = 200;

/**
 * Calls back once the page has loaded, gone idle (see `whenSettled`) and then held still for a
 * moment, so a scene is never built during the page's load or under a scrolling reader, including
 * the smooth scroll a Back or Forward restores. Returns a function that stops waiting.
 */
export function whenStill(callback: () => void): () => void {
  let timer = 0;
  let stopSettled = () => {};
  const wait = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      window.removeEventListener('scroll', wait);
      // One more idle period, in case the scroll ended inside a busy frame.
      stopSettled = whenSettled(window, callback);
    }, STILL_MS);
  };
  const stopFirst = whenSettled(window, () => {
    window.addEventListener('scroll', wait, { passive: true });
    wait();
  });
  return () => {
    stopFirst();
    stopSettled();
    window.clearTimeout(timer);
    window.removeEventListener('scroll', wait);
  };
}
