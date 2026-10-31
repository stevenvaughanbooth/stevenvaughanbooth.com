/**
 * The geometry of a page curl, as a pure function of where the page's top-right corner has been
 * pulled to. Real paper folds along the line halfway between where the corner was and where it
 * is now (their perpendicular bisector): everything on the corner's side of that line lifts and
 * lands mirrored on the other side, so the corner sits exactly under the finger. peel.ts draws it.
 * The end of the file judges a let-go corner: does it carry on and peel the page, or spring back?
 */

export type Point = readonly [x: number, y: number];

export interface Fold {
  /** A point on the fold: halfway between the corner and where it has been pulled. */
  mid: Point;
  /** Unit vector across the fold, from the corner's side towards the pulled corner. */
  normal: Point;
}

export interface Pose {
  /** What still lies flat, as a convex polygon in viewport pixels; empty once all has lifted. */
  page: Point[];
  /** The lifted part, folded over: the corner region mirrored across the fold. */
  flap: Point[];
  /** Null while the corner is home and nothing has lifted. */
  fold: Fold | null;
  /** How far the fold has come in from the corner, as a share of the page's diagonal. */
  travel: number;
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

/** Signed distance from the fold: negative on the corner's side, positive past it. */
export const side = (fold: Fold, point: Point) =>
  dot([point[0] - fold.mid[0], point[1] - fold.mid[1]], fold.normal);

/** The fold for a corner pulled to `pointer`, or null when it hasn't moved. */
export function foldFor(corner: Point, pointer: Point): Fold | null {
  const dx = pointer[0] - corner[0];
  const dy = pointer[1] - corner[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  return {
    mid: [(corner[0] + pointer[0]) / 2, (corner[1] + pointer[1]) / 2],
    normal: [dx / length, dy / length],
  };
}

/** A point mirrored across the fold. */
export function reflect(fold: Fold, point: Point): Point {
  const distance = side(fold, point);
  return [point[0] - 2 * distance * fold.normal[0], point[1] - 2 * distance * fold.normal[1]];
}

/**
 * Cuts a convex polygon along the fold, keeping the part past it (`keep` 1) or on the corner's
 * side (`keep` -1): one pass of Sutherland–Hodgman.
 */
export function clip(polygon: readonly Point[], fold: Fold, keep: 1 | -1): Point[] {
  const out: Point[] = [];
  polygon.forEach((current, i) => {
    const next = polygon[(i + 1) % polygon.length]!;
    const a = keep * side(fold, current);
    const b = keep * side(fold, next);
    if (a >= 0) out.push(current);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      out.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  });
  return out;
}

/** The corner a `width` × `height` page is pulled from. */
export const cornerOf = (width: number): Point => [width, 0];

/**
 * Keeps a pulled corner on the page. Pulled outwards (above or to the right of where it started)
 * the fold would sweep the wrong way and lift everything at once.
 */
export function constrain(width: number, pointer: Point): Point {
  return [Math.min(pointer[0], width), Math.max(pointer[1], 0)];
}

/** The page and the flap with the top-right corner pulled to `pointer`. */
export function poseFor(width: number, height: number, pointer: Point): Pose {
  const corner = cornerOf(width);
  const rect: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const fold = foldFor(corner, pointer);
  if (!fold) return { page: rect, flap: [], fold: null, travel: 0 };
  const lifted = clip(rect, fold, -1);
  return {
    page: clip(rect, fold, 1),
    flap: lifted.map((point) => reflect(fold, point)),
    fold,
    travel:
      Math.hypot(pointer[0] - corner[0], pointer[1] - corner[1]) / 2 / Math.hypot(width, height),
  };
}

/**
 * Where to pull the corner to lift the whole page, heading `direction` from the corner: far
 * enough that the fold has passed every corner of the page, and the flap has left it.
 */
export function peeledPoint(width: number, height: number, direction: Point): Point {
  const corner = cornerOf(width);
  const length = Math.hypot(direction[0], direction[1]) || 1;
  const unit: Point = [direction[0] / length, direction[1] / length];
  const corners: Point[] = [
    [0, 0],
    [0, height],
    [width, height],
  ];
  const reach = Math.max(...corners.map(([x, y]) => (x - corner[0]) * unit[0] + y * unit[1]));
  const distance = 2 * reach + 48;
  return [corner[0] + unit[0] * distance, corner[1] + unit[1] * distance];
}

/** The way a scripted peel heads: along the diagonal to the bottom-left corner. */
export const diagonal = (width: number, height: number): Point => [-width, height];

/** Past this share of the diagonal, a released fold carries on and peels the page away. */
export const COMMIT_TRAVEL = 0.25;
/** A flick into the page faster than this (px/ms) peels it away from any distance. */
const FLICK = 0.6;

/**
 * The pointer's speed over the tenth of a second before `now` (when it was let go), in px/ms: a
 * hand that stopped before letting go has none.
 */
export function velocityOf(samples: readonly { time: number; point: Point }[], now: number): Point {
  const recent = samples.filter((sample) => now - sample.time <= 100);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.time - first.time < 1) return [0, 0];
  const dt = last.time - first.time;
  return [(last.point[0] - first.point[0]) / dt, (last.point[1] - first.point[1]) / dt];
}

/**
 * Whether a released corner peels the page away: it was pulled far enough, or flicked into the
 * page. Otherwise it springs back.
 */
export function peelsAway(travel: number, velocity: Point, width: number, height: number) {
  const [dx, dy] = diagonal(width, height);
  const inward = (velocity[0] * dx + velocity[1] * dy) / Math.hypot(dx, dy);
  return travel >= COMMIT_TRAVEL || (inward > FLICK && travel > 0.01);
}
