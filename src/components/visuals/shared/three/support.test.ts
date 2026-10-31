import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSceneSupport, sceneOptOut } from './support';

function stubMedia(reducedData = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedData && query === '(prefers-reduced-data: reduce)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function stubWebGL(available: boolean) {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  const lose = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
    kind === 'webgl2' && available
      ? { getExtension: () => ({ loseContext: lose }) }
      : null) as never);
  return lose;
}

beforeEach(() => {
  resetSceneSupport();
  stubMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sceneOptOut', () => {
  it('lets a capable device draw in 3D, releasing the context it probed with', () => {
    const lose = stubWebGL(true);
    expect(sceneOptOut()).toBeNull();
    expect(lose).toHaveBeenCalledOnce();
    // The probe runs once a page.
    expect(sceneOptOut()).toBeNull();
    expect(lose).toHaveBeenCalledOnce();
  });

  it('keeps the 2D card without WebGL 2', () => {
    expect(sceneOptOut()).toBe('no-webgl');
    resetSceneSupport();
    stubWebGL(false);
    expect(sceneOptOut()).toBe('no-webgl');
  });

  it('keeps the 2D card when data or memory is scarce, before probing WebGL', () => {
    const lose = stubWebGL(true);
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    expect(sceneOptOut()).toBe('save-data');
    vi.stubGlobal('navigator', { deviceMemory: 2 });
    expect(sceneOptOut()).toBe('low-memory');
    vi.stubGlobal('navigator', { deviceMemory: 4 });
    stubMedia(true);
    expect(sceneOptOut()).toBe('reduced-data');
    expect(lose).not.toHaveBeenCalled();
  });
});
