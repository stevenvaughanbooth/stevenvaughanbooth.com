import { describe, expect, it } from 'vitest';
import {
  clip,
  COMMIT_TRAVEL,
  constrain,
  diagonal,
  foldFor,
  peeledPoint,
  peelsAway,
  type Point,
  poseFor,
  reflect,
  side,
  velocityOf,
} from './fold';

/** A polygon's area (shoelace). */
const area = (points: readonly Point[]) =>
  Math.abs(
    points.reduce((sum, [x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length]!;
      return sum + x * ny - nx * y;
    }, 0) / 2,
  );

const near = (a: Point, b: Point) => {
  expect(a[0]).toBeCloseTo(b[0]);
  expect(a[1]).toBeCloseTo(b[1]);
};

const W = 1440;
const H = 900;
const corner: Point = [W, 0];

describe('foldFor', () => {
  it('folds along the perpendicular bisector of the corner and the pointer', () => {
    const fold = foldFor(corner, [W - 200, 200])!;
    near(fold.mid, [W - 100, 100]);
    near(fold.normal, [-Math.SQRT1_2, Math.SQRT1_2]);
    // Both ends are the same distance from the fold, on either side of it.
    expect(side(fold, corner)).toBeCloseTo(-side(fold, [W - 200, 200]));
    // Points on the bisector are on the fold.
    expect(side(fold, [W - 200, 0])).toBeCloseTo(0);
    expect(side(fold, [W, 200])).toBeCloseTo(0);
  });

  it('has no fold until the corner moves', () => {
    expect(foldFor(corner, corner)).toBeNull();
  });
});

describe('reflect', () => {
  it('mirrors the corner onto the pointer, and leaves the fold where it is', () => {
    const pointer: Point = [W - 300, 120];
    const fold = foldFor(corner, pointer)!;
    near(reflect(fold, corner), pointer);
    const onFold: Point = [fold.mid[0] - fold.normal[1] * 50, fold.mid[1] + fold.normal[0] * 50];
    near(reflect(fold, onFold), onFold);
  });
});

describe('clip', () => {
  it('cuts a polygon in two along the fold', () => {
    const square: Point[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const fold = foldFor([100, 0], [0, 100])!;
    expect(area(clip(square, fold, 1))).toBeCloseTo(5000);
    expect(area(clip(square, fold, -1))).toBeCloseTo(5000);
  });
});

describe('poseFor', () => {
  it('starts flat, with no flap', () => {
    const pose = poseFor(W, H, corner);
    expect(area(pose.page)).toBeCloseTo(W * H);
    expect(pose.flap).toEqual([]);
    expect(pose.travel).toBe(0);
  });

  it('lifts the corner triangle first, and puts the corner under the pointer', () => {
    const pointer: Point = [W - 200, 200];
    const pose = poseFor(W, H, pointer);
    expect(pose.page).toHaveLength(5);
    expect(area(pose.page)).toBeCloseTo(W * H - (200 * 200) / 2);
    expect(pose.flap).toHaveLength(3);
    expect(
      pose.flap.some((point) => Math.hypot(point[0] - pointer[0], point[1] - pointer[1]) < 1e-6),
    ).toBe(true);
    expect(area(pose.flap)).toBeCloseTo((200 * 200) / 2);
  });

  it('turns over a whole strip when pulled straight left or straight down', () => {
    // Straight left: the fold is upright, and the right-hand strip turns over like a book page.
    const left = poseFor(W, H, [W - 400, 0]);
    expect(area(left.page)).toBeCloseTo((W - 200) * H);
    expect(left.page.every(([x]) => x <= W - 200 + 1e-9)).toBe(true);
    // Straight down: the fold runs across, and the top strip turns down.
    const down = poseFor(W, H, [W, 300]);
    expect(area(down.page)).toBeCloseTo(W * (H - 150));
  });

  it('changes shape as the fold passes each corner of the page', () => {
    // Pulled at 45°, the fold crosses the top and right edges, then (past the height) the top
    // and bottom, then (past the width) the left and bottom.
    const shapes = [0.1, 0.4, 0.8].map((share) => {
      const reach = share * (W + H);
      return poseFor(W, H, [W - reach, reach]);
    });
    expect(shapes.map(({ page }) => page.length)).toEqual([5, 4, 3]);
    for (const { page, flap } of shapes) {
      // What lifted is what landed: folding keeps the area.
      expect(area(page) + area(flap)).toBeCloseTo(W * H);
    }
  });

  it('measures how far the fold has come as a share of the diagonal', () => {
    const along = diagonal(W, H);
    const length = Math.hypot(...along);
    const pointer: Point = [W + (along[0] / length) * length, (along[1] / length) * length];
    expect(poseFor(W, H, pointer).travel).toBeCloseTo(0.5);
  });
});

describe('peeledPoint', () => {
  it('pulls far enough that nothing is left lying flat, whichever way', () => {
    for (const direction of [diagonal(W, H), [-1, 0], [0, 1], [-1, 3]] as Point[]) {
      expect(poseFor(W, H, peeledPoint(W, H, direction)).page).toEqual([]);
    }
  });
});

describe('constrain', () => {
  it('keeps the corner from being pulled off the page', () => {
    expect(constrain(W, [W + 50, -20])).toEqual([W, 0]);
    expect(constrain(W, [300, 400])).toEqual([300, 400]);
  });
});

describe('letting go', () => {
  const sample = (time: number, x: number, y: number) => ({ time, point: [x, y] as const });

  it('measures the hand’s speed just before it let go, and none if it had stopped', () => {
    const samples = [sample(0, 1400, 10), sample(50, 1300, 60), sample(100, 1200, 110)];
    const [vx, vy] = velocityOf(samples, 110);
    expect(vx).toBeCloseTo(-2);
    expect(vy).toBeCloseTo(1);
    expect(velocityOf(samples, 400)).toEqual([0, 0]);
  });

  it('peels away when pulled past the threshold, or flicked into the page', () => {
    expect(peelsAway(COMMIT_TRAVEL, [0, 0], W, H)).toBe(true);
    expect(peelsAway(COMMIT_TRAVEL - 0.01, [0, 0], W, H)).toBe(false);
    expect(peelsAway(0.05, [-1.5, 1], W, H)).toBe(true);
    // A flick back towards the corner is no reason to peel.
    expect(peelsAway(0.05, [1.5, -1], W, H)).toBe(false);
  });
});
