import { afterEach, describe, expect, it, vi } from 'vitest';
import { interactionDurations, observeInteractions, recordInteraction } from './interactions';
import {
  cumulativeLayoutShift,
  formatCount,
  formatKilobytes,
  formatMilliseconds,
  formatSeconds,
  formatShift,
  interactionToNextPaint,
  observeVitals,
  rate,
  summarizeResources,
} from './metrics';

const shift = (startTime: number, value: number, hadRecentInput = false) => ({
  startTime,
  value,
  hadRecentInput,
});

const resource = (name: string, init: Partial<PerformanceResourceTiming> = {}) =>
  ({
    name,
    initiatorType: 'other',
    transferSize: 0,
    decodedBodySize: 0,
    ...init,
  }) as PerformanceResourceTiming;

afterEach(() => {
  interactionDurations.clear();
  vi.unstubAllGlobals();
});

describe('cumulativeLayoutShift', () => {
  it('is 0 without shifts', () => {
    expect(cumulativeLayoutShift([])).toBe(0);
  });

  it('adds shifts less than a second apart into one session window', () => {
    expect(cumulativeLayoutShift([shift(100, 0.05), shift(600, 0.05)])).toBeCloseTo(0.1);
  });

  it('reports the largest window, starting a new one after a 1 s gap', () => {
    const shifts = [shift(0, 0.02), shift(500, 0.02), shift(3000, 0.1), shift(3500, 0.01)];
    expect(cumulativeLayoutShift(shifts)).toBeCloseTo(0.11);
  });

  it('closes a window once it spans 5 s', () => {
    const shifts = Array.from({ length: 12 }, (_, i) => shift(i * 900, 0.01));
    // 0, 900, ..., 4500 fit in the first window (6 shifts); 5400 starts the next.
    expect(cumulativeLayoutShift(shifts)).toBeCloseTo(0.06);
  });

  it('leaves out shifts caused by input', () => {
    expect(cumulativeLayoutShift([shift(0, 0.3, true), shift(10, 0.01)])).toBeCloseTo(0.01);
  });
});

describe('interactionToNextPaint', () => {
  it('is undefined before any interaction', () => {
    expect(interactionToNextPaint([])).toBeUndefined();
  });

  it('is the slowest interaction on a short visit', () => {
    expect(interactionToNextPaint([40, 180, 96])).toBe(180);
  });

  it('ignores the slowest one in every 50 on a long visit', () => {
    const durations = [...Array.from({ length: 98 }, () => 16), 400, 300];
    // 100 interactions: the two slowest are set aside.
    expect(interactionToNextPaint(durations)).toBe(16);
    expect(interactionToNextPaint(durations.slice(1))).toBe(300);
  });
});

describe('recordInteraction', () => {
  it('keeps the longest event of each interaction and skips lone events', () => {
    const entry = (interactionId: number, duration: number) =>
      ({ interactionId, duration }) as unknown as PerformanceEntry;
    recordInteraction(entry(7, 24));
    recordInteraction(entry(7, 56));
    recordInteraction(entry(7, 32));
    recordInteraction(entry(0, 500));
    recordInteraction(entry(9, 16));
    expect([...interactionDurations]).toEqual([
      [7, 56],
      [9, 16],
    ]);
  });

  it('starts no observer where the browser has no Event Timing', () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    expect(() => observeInteractions()).not.toThrow();
  });
});

describe('summarizeResources', () => {
  const origin = 'https://stevenvaughanbooth.com';

  it('counts requests with the document, and the script bytes that crossed the network', () => {
    const summary = summarizeResources(
      [
        resource(`${origin}/_next/static/chunks/a.js`, {
          initiatorType: 'script',
          transferSize: 40_000,
          decodedBodySize: 120_000,
        }),
        resource(`${origin}/_next/static/chunks/b.js?v=1`, {
          initiatorType: 'link',
          transferSize: 9_000,
          decodedBodySize: 25_000,
        }),
        resource(`${origin}/_next/static/chunks/c.css`, {
          initiatorType: 'link',
          transferSize: 15_000,
          decodedBodySize: 80_000,
        }),
      ],
      origin,
    );
    expect(summary).toEqual({
      requests: 4,
      scripts: 2,
      scriptBytes: 49_000,
      cachedScripts: 0,
      opaque: 0,
    });
  });

  it('notes scripts from the cache and cross-origin entries that report nothing', () => {
    const summary = summarizeResources(
      [
        resource(`${origin}/a.js`, { initiatorType: 'script', decodedBodySize: 5_000 }),
        resource('https://cdn.example/b.js', { initiatorType: 'script' }),
      ],
      origin,
    );
    expect(summary.cachedScripts).toBe(1);
    expect(summary.opaque).toBe(1);
    expect(summary.scriptBytes).toBe(0);
  });
});

describe('rate', () => {
  it('uses web.dev’s thresholds', () => {
    expect(rate('lcp', 2500)).toBe('good');
    expect(rate('lcp', 2501)).toBe('needs improvement');
    expect(rate('lcp', 4001)).toBe('poor');
    expect(rate('fcp', 1800)).toBe('good');
    expect(rate('cls', 0.1)).toBe('good');
    expect(rate('cls', 0.26)).toBe('poor');
    expect(rate('inp', 200)).toBe('good');
    expect(rate('inp', 350)).toBe('needs improvement');
  });
});

describe('formatting', () => {
  it('writes each number the way the HUD shows it', () => {
    expect(formatSeconds(1210)).toBe('1.21 s');
    expect(formatMilliseconds(47.6)).toBe('48 ms');
    expect(formatShift(0)).toBe('0');
    expect(formatShift(0.0123)).toBe('0.012');
    expect(formatShift(0.0002)).toBe('< 0.001');
    expect(formatKilobytes(168_263)).toBe('164 KB');
    expect(formatCount(1834)).toBe('1,834');
  });
});

describe('observeVitals', () => {
  it('reads FCP, LCP, CLS and INP from buffered entries, and stops when asked', () => {
    const observers: { type: string; callback: PerformanceObserverCallback }[] = [];
    const disconnect = vi.fn();
    class FakeObserver {
      static supportedEntryTypes = ['paint', 'largest-contentful-paint', 'layout-shift', 'event'];
      constructor(private readonly callback: PerformanceObserverCallback) {}
      observe({ type }: PerformanceObserverInit) {
        observers.push({ type: type ?? '', callback: this.callback });
      }
      disconnect = disconnect;
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    const emit = (type: string, entries: object[]) => {
      const list = { getEntries: () => entries } as unknown as PerformanceObserverEntryList;
      for (const observer of observers.filter((o) => o.type === type)) {
        observer.callback(list, {} as PerformanceObserver);
      }
    };

    const onChange = vi.fn();
    const stop = observeVitals(onChange);
    expect(onChange).toHaveBeenLastCalledWith({ cls: 0, interactions: 0, inp: undefined });

    emit('paint', [
      { name: 'first-paint', startTime: 300 },
      { name: 'first-contentful-paint', startTime: 420 },
    ]);
    emit('largest-contentful-paint', [{ startTime: 500 }, { startTime: 900 }]);
    emit('layout-shift', [shift(1000, 0.02), shift(1200, 0.01)]);
    emit('event', [{ interactionId: 3, duration: 72 }]);

    expect(onChange).toHaveBeenLastCalledWith({
      fcp: 420,
      lcp: 900,
      cls: expect.closeTo(0.03),
      inp: 72,
      interactions: 1,
    });
    stop();
    expect(disconnect).toHaveBeenCalledTimes(4);
  });
});
