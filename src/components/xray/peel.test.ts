import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/browser-mocks';
import { canPeel, FLAP_REACH, peel, peelShapes, peelStops } from './peel';

type Point = readonly [number, number];

/** Twice the signed area of a polygon (shoelace), positive or negative by winding. */
const area = (points: readonly Point[]) =>
  Math.abs(
    points.reduce((sum, [x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length]!;
      return sum + x * ny - nx * y;
    }, 0) / 2,
  );

/** How far a point lies from the top-right corner, measured into the page at 45°. */
const depth = (width: number, [x, y]: Point) => (width - x + y) / Math.SQRT2;

const W = 1440;
const H = 900;

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('peelShapes', () => {
  it('starts with the whole page flat and no flap', () => {
    const { page, flap } = peelShapes(W, H, 0);
    expect(area(page)).toBeCloseTo(W * H);
    expect(area(flap)).toBeCloseTo(0);
  });

  it('ends with nothing left lying flat', () => {
    const end = peelStops(W, H).at(-1)!;
    expect(end).toBeCloseTo((W + H) / Math.SQRT2);
    expect(area(peelShapes(W, H, end).page)).toBeCloseTo(0);
  });

  it('keeps the same number of points all the way, so the browser can interpolate', () => {
    for (const s of [0, 100, 700, 1200, 1600]) {
      const { page, flap } = peelShapes(W, H, s);
      expect(page).toHaveLength(7);
      expect(flap).toHaveLength(5);
    }
  });

  it('lifts exactly the corner triangle at first, and the page keeps the rest', () => {
    const s = 200;
    const leg = s * Math.SQRT2;
    const { page } = peelShapes(W, H, s);
    expect(area(page)).toBeCloseTo(W * H - (leg * leg) / 2);
    // The fold crosses the top edge and the right edge at the same depth.
    expect(page[0]).toEqual([W - leg, 0]);
    expect(page[4]).toEqual([W, leg]);
    expect(depth(W, page[0]!)).toBeCloseTo(s);
  });

  it('folds the lifted part over the line, landing a little short of its mirror image', () => {
    const s = 300;
    const { flap } = peelShapes(W, H, s);
    // The corner itself goes furthest: (1 + reach) times the fold's depth.
    expect(depth(W, flap[0]!)).toBeCloseTo((1 + FLAP_REACH) * s);
    // Points on the fold stay put.
    for (const point of flap.slice(1)) expect(depth(W, point)).toBeCloseTo(s);
  });

  it('changes shape only at the stops, where the fold passes a corner', () => {
    expect(peelStops(W, H).map((s) => Math.round(s * Math.SQRT2))).toEqual([0, 900, 1440, 2340]);
    // A square viewport has one corner fewer to pass.
    expect(peelStops(500, 500)).toHaveLength(3);
  });
});

describe('peel', () => {
  it('changes the page at once under reduced motion', async () => {
    mockReducedMotion(true);
    const start = vi.fn();
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    vi.stubGlobal('CSS', { supports: () => true });
    const update = vi.fn();
    expect(canPeel()).toBe(false);
    await peel({ lifting: true, update });
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('runs a typed view transition, with its helpers, where it can', async () => {
    mockReducedMotion(false);
    vi.stubGlobal('CSS', { supports: () => true });
    let finish = () => {};
    const start = vi.fn((options: StartViewTransitionOptions) => {
      if (typeof options.update === 'function') void options.update();
      return {
        updateCallbackDone: Promise.resolve(),
        ready: new Promise(() => {}),
        finished: new Promise<void>((resolve) => (finish = resolve)),
      };
    });
    Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
    const update = vi.fn(() => {
      // The helpers are in the page while the new state is captured.
      expect(document.querySelectorAll('[data-xray-peel]')).toHaveLength(2);
    });

    await peel({ lifting: false, update });
    expect(update).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith({
      update: expect.any(Function),
      types: ['xray', 'xray-lay'],
    });
    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelectorAll('[data-xray-peel]')).toHaveLength(0);
  });
});
