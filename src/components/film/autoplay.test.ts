import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameQuery, markPlayed, mayPlayInFrame, whenSettled } from './autoplay';

interface Conditions {
  wide?: boolean;
  reduceMotion?: boolean;
  reduceData?: boolean;
  connection?: { saveData?: boolean; effectiveType?: string };
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

function env({
  wide = true,
  reduceMotion = false,
  reduceData = false,
  connection,
  storage = memoryStorage(),
}: Conditions = {}) {
  return {
    matchMedia: (query: string) =>
      ({
        matches:
          (query === frameQuery && wide) ||
          (query === '(prefers-reduced-motion: no-preference)' && !reduceMotion) ||
          (query === '(prefers-reduced-data: reduce)' && reduceData),
      }) as MediaQueryList,
    navigator: { connection } as unknown as Navigator,
    sessionStorage: storage as Storage,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('mayPlayInFrame', () => {
  it('plays in a frame big enough to watch, when nothing argues against it', () => {
    expect(mayPlayInFrame(env())).toBe(true);
    expect(mayPlayInFrame(env({ connection: { saveData: false, effectiveType: '4g' } }))).toBe(
      true,
    );
  });

  it.each<[string, Conditions]>([
    ['below md, where the portrait is an 88px avatar', { wide: false }],
    ['under reduced motion', { reduceMotion: true }],
    ['when the visitor asks for less data', { reduceData: true }],
    ['with Save-Data on', { connection: { saveData: true } }],
    ['on a 2G connection', { connection: { effectiveType: 'slow-2g' } }],
  ])('stays still %s', (_, conditions) => {
    expect(mayPlayInFrame(env(conditions))).toBe(false);
  });

  it('plays once a visit', () => {
    const visit = env();
    markPlayed(visit);
    expect(mayPlayInFrame(visit)).toBe(false);
  });

  it('still decides when storage is unavailable', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    const visit = env({ storage: blocked });
    expect(() => markPlayed(visit)).not.toThrow();
    expect(mayPlayInFrame(visit)).toBe(true);
  });
});

describe('whenSettled', () => {
  function fakeWindow(readyState: DocumentReadyState, idle = true) {
    const target = new EventTarget();
    return Object.assign(target, {
      document: { readyState },
      requestIdleCallback: idle ? vi.fn((callback: () => void) => setTimeout(callback, 5)) : 0,
      cancelIdleCallback: vi.fn((handle: number) => clearTimeout(handle)),
      setTimeout: (callback: () => void) => setTimeout(callback),
      clearTimeout: (handle: number) => clearTimeout(handle),
    }) as unknown as Window;
  }

  it('waits for the load event, then for idle', () => {
    vi.useFakeTimers();
    const win = fakeWindow('interactive');
    const callback = vi.fn();
    whenSettled(win, callback);
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('load'));
    expect(win.requestIdleCallback).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('goes straight to idle after load, and stands in a task where idle is missing', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    whenSettled(fakeWindow('complete', false), callback);
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('can be cancelled at either stage', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const beforeLoad = fakeWindow('loading');
    whenSettled(beforeLoad, callback)();
    beforeLoad.dispatchEvent(new Event('load'));
    whenSettled(fakeWindow('complete'), callback)();
    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });
});
