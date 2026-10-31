import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/browser-mocks';
import { poseFor } from './fold';
import { canPeel, peel, poseStyles, pull, spring } from './peel';

const W = 1440;
const H = 900;
const diagonalLength = Math.hypot(W, H);

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'startViewTransition');
});

describe('poseStyles', () => {
  it('leaves the page whole and hides the helpers while the corner is home', () => {
    const styles = poseStyles(poseFor(W, H, [W, 0]), diagonalLength);
    expect(styles.page.clipPath).toBe(`polygon(0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px)`);
    expect(styles.flap.transform).toBe('scale(0)');
  });

  it('lays the helpers along the fold, turned with it', () => {
    // Pulled straight left, the fold stands upright: the helpers' x axis points left.
    const styles = poseStyles(poseFor(W, H, [W - 400, 0]), diagonalLength);
    expect(styles.flap.transform).toMatch(/^matrix\(-1, 0, 0, -1, /);
    expect(styles.shade.transform).toMatch(/^matrix\(1, 0, 0, -1, /);
    // The flap is clipped, in its own quarter-size units, to the strip that turned over: from
    // the fold (x 0) to 200px past it.
    const xs = [...styles.flap.clipPath.matchAll(/(-?[\d.e-]+)px (-?[\d.e-]+)px/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(200 / 4);
  });
});

describe('motions', () => {
  it('pulls along a straight line, easing in and out, and arrives on time', () => {
    const motion = pull([W, 0], [0, H], 0, 900);
    expect(motion(0)).toEqual({ point: [W, 0], done: false });
    expect(motion(450).point[0]).toBeCloseTo(W / 2);
    expect(motion(100).point[0]).toBeGreaterThan(W - W * 0.05);
    expect(motion(900)).toEqual({ point: [0, H], done: true });
  });

  it('springs home without overshooting, from rest', () => {
    const motion = spring([W - 300, 200], [0, 0], [W, 0], 16, 0);
    let x = W - 300;
    for (let t = 16; t < 2000; t += 16) {
      const { point, done } = motion(t);
      expect(point[0]).toBeGreaterThanOrEqual(x);
      expect(point[0]).toBeLessThanOrEqual(W);
      x = point[0];
      if (done) {
        expect(point).toEqual([W, 0]);
        return;
      }
    }
    throw new Error('never arrived');
  });

  it('can end a spring early, once it has done its work', () => {
    const motion = spring([W - 300, 200], [-1, 1], [-2000, 3000], 9, 0, ([x]) => x < 0);
    expect(motion(0).done).toBe(false);
    expect(motion(2000).done).toBe(true);
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

  it('runs a typed view transition, with its helpers, and changes the page even if skipped', async () => {
    mockReducedMotion(false);
    vi.stubGlobal('CSS', { supports: () => true });
    const start = vi.fn((options: StartViewTransitionOptions) => {
      if (typeof options.update === 'function') void options.update();
      return {
        updateCallbackDone: Promise.resolve(),
        ready: Promise.reject(new Error('skipped')),
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
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
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.querySelectorAll('[data-xray-peel]')).toHaveLength(0);
  });
});
