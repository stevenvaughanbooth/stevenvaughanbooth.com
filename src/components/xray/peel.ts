import { constrain, cornerOf, diagonal, peeledPoint, type Point, type Pose, poseFor } from './fold';

/**
 * The peel: the page's top-right corner is pulled across the screen, folding the page back over
 * itself to show the blueprint underneath (X-ray), or laid back down from there. A visitor can
 * pull the corner by hand, from the dog-ear (a drag), or the toggle and X pull it along a scripted
 * path; both drive this one engine, so they look the same.
 *
 * It is one view transition of type "xray". The page as it was is one snapshot, clipped to the
 * part still lying flat; the page it becomes is the other, underneath. Two helper elements exist
 * only for the transition, each with a view-transition-name of its own so they draw above both
 * snapshots: the flap (the back of the lifted sheet, shaded like paper that curls at the fold) and
 * the shade (the shadow the lifted edge casts on the blueprint). Every frame, each pose (fold.ts)
 * becomes a clip-path and a transform on those pseudo-elements, through paused animations whose
 * keyframes are replaced, so nothing else on the page is restyled. The transition stays alive
 * while those animations do: as long as a finger holds the corner.
 */

/** Helpers are drawn at a quarter size and scaled up: their gradients are smooth anyway. */
const SCALE = 4;
/** How far the shadow at the fold reaches across the blueprint. */
const SHADE = 90;
/** A scripted peel's length, and its easing (the CSS cubic-bezier(0.65, 0, 0.35, 1)). */
export const DURATION = 900;
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** The colours of the sheet's back and its shadow, for the theme of the page being lifted. */
function paper(dark: boolean) {
  return dark
    ? { crease: '#7a8494', roll: '#1b1f26', sheen: '#2d333d', back: '#1d2128', tip: '#121418' }
    : { crease: '#ffffff', roll: '#deded6', sheen: '#f3f3ee', back: '#e6e6df', tip: '#cfcfc6' };
}

const px = (value: number) => `${value / SCALE}px`;

/**
 * A helper: a strip `depth` deep and twice the diagonal long, drawn at a quarter size and scaled
 * up. Each frame turns and places it on the fold, so its gradient always runs across the fold.
 */
function helper(name: string, depth: number, length: number, background: string) {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.xrayPeel = name;
  Object.assign(element.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: px(depth),
    height: px(length),
    transformOrigin: '0 0',
    transform: `scale(${SCALE})`,
    pointerEvents: 'none',
    viewTransitionName: name,
    background,
  });
  return element;
}

function helpers(diagonalLength: number, dark: boolean) {
  const { crease, roll, sheen, back, tip } = paper(dark);
  const length = 2 * diagonalLength;
  return {
    flap: helper(
      'xray-flap',
      diagonalLength,
      length,
      `linear-gradient(to right, ${crease}, ${roll} ${px(22)}, ${sheen} ${px(70)}, ${back} ${px(320)}, ${tip})`,
    ),
    shade: helper(
      'xray-shade',
      SHADE,
      length,
      `linear-gradient(to right, rgb(2 10 24 / 0.5), rgb(2 10 24 / 0.18) ${px(28)}, transparent)`,
    ),
  };
}

const empty = 'polygon(0 0, 0 0, 0 0)';

const polygon = (points: readonly Point[]) =>
  points.length < 3 ? empty : `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;

/**
 * The styles of one pose: the flat page's clip, and where the flap and the shade go. The helpers
 * are laid along the fold, their x axis across it (the shade's facing back towards the corner)
 * and their y axis along it, centred on the fold's midpoint; the flap is clipped, in its own
 * coordinates, to the mirrored corner.
 */
export function poseStyles(pose: Pose, diagonalLength: number) {
  const { fold } = pose;
  if (!fold) {
    return {
      page: { clipPath: polygon(pose.page) },
      flap: { transform: `scale(0)`, clipPath: empty },
      shade: { transform: `scale(0)` },
    };
  }
  const [nx, ny] = fold.normal;
  const [tx, ty] = [-ny, nx];
  // The helpers' top-left corner: a diagonal back along the fold from its midpoint.
  const ox = (fold.mid[0] - diagonalLength * tx) / SCALE;
  const oy = (fold.mid[1] - diagonalLength * ty) / SCALE;
  const local = ([x, y]: Point): Point => {
    const dx = x - fold.mid[0];
    const dy = y - fold.mid[1];
    return [(dx * nx + dy * ny) / SCALE, (dx * tx + dy * ty + diagonalLength) / SCALE];
  };
  return {
    page: { clipPath: polygon(pose.page) },
    flap: {
      transform: `matrix(${nx}, ${ny}, ${tx}, ${ty}, ${ox}, ${oy})`,
      clipPath: polygon(pose.flap.map(local)),
    },
    shade: { transform: `matrix(${-nx}, ${-ny}, ${tx}, ${ty}, ${ox}, ${oy})` },
  };
}

/** Whether this browser can run the peel: typed view transitions scope its CSS to it. */
export function canPeel(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    CSS.supports('selector(:active-view-transition-type(xray))') &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Where the corner is, over time: a motion reports its point and whether it has arrived. */
type Motion = (now: number) => { point: Point; done: boolean };

/**
 * A critically damped spring from `from` (moving at `velocity`, in px/ms) to `target`: it never
 * overshoots, so a corner sprung home never flips the fold. `arrived` can end it early.
 */
export function spring(
  from: Point,
  velocity: Point,
  target: Point,
  stiffness: number,
  start: number,
  arrived: (point: Point) => boolean = () => false,
): Motion {
  const axis = (i: 0 | 1) => {
    const x0 = from[i] - target[i];
    const v0 = velocity[i] * 1000;
    return (t: number) => target[i] + (x0 + (v0 + stiffness * x0) * t) * Math.exp(-stiffness * t);
  };
  const x = axis(0);
  const y = axis(1);
  return (now) => {
    const t = Math.max(0, now - start) / 1000;
    const point: Point = [x(t), y(t)];
    const home = Math.hypot(point[0] - target[0], point[1] - target[1]) < 0.5;
    return { point: home ? target : point, done: home || arrived(point) };
  };
}

/** A straight pull from `from` to `to` over `duration`, eased in and out. */
export function pull(from: Point, to: Point, start: number, duration = DURATION): Motion {
  return (now) => {
    const t = Math.min(1, Math.max(0, now - start) / duration);
    const k = ease(t);
    return {
      point: [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k],
      done: t >= 1,
    };
  };
}

export interface Curl {
  readonly width: number;
  readonly height: number;
  /** Puts the corner at `point` (kept on the page) on the next frame. */
  to(point: Point): void;
  /** Moves the corner along `motion`; resolves when it arrives. */
  run(motion: Motion): Promise<void>;
  /** Ends the transition, leaving the page as it now is. */
  end(): void;
  /** Resolves if the browser ends the transition first (another one started, the tab hid). */
  readonly lost: Promise<void>;
}

interface CurlOptions {
  /** True to lift the page off (X-ray on), false to lay it back down. */
  lifting: boolean;
  /** Changes the page: called inside the transition, between the two snapshots. */
  update: () => void;
  /** Where the corner starts. */
  from: Point;
}

/**
 * Starts the transition and gives back control of the corner once both pages are captured, or
 * null if the browser skipped it (`update` has run either way). The caller moves the corner, and
 * ends it.
 */
export async function startCurl({ lifting, update, from }: CurlOptions): Promise<Curl | null> {
  const width = innerWidth;
  const height = innerHeight;
  const length = Math.hypot(width, height);
  const root = document.documentElement;
  // The sheet is the normal page, so its back takes the visitor's theme.
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
    ? root.dataset.theme !== 'light'
    : root.dataset.theme === 'dark';
  const { flap, shade } = helpers(length, dark);

  const transition = document.startViewTransition({
    update() {
      document.body.append(shade, flap);
      update();
    },
    types: ['xray', lifting ? 'xray-lift' : 'xray-lay'],
  });
  // Animations on pseudo-elements outlive their transition, and the next transition's
  // pseudo-elements would pick them up: they go with the helpers.
  const animations: Animation[] = [];
  let ended = false;
  const lost = transition.finished.then(
    () => {},
    () => {},
  );
  void lost.then(() => {
    shade.remove();
    flap.remove();
    for (const animation of animations) animation.cancel();
  });

  try {
    await transition.ready;
  } catch {
    // Skipped (hidden tab, another transition): the page has changed, with no curl to show.
    return null;
  }

  const hold = (pseudoElement: string) => {
    // Paused, so the transition lasts until it is ended; its keyframes change every frame.
    const animation = root.animate([{}, {}], { duration: 1000, fill: 'both', pseudoElement });
    animation.pause();
    animations.push(animation);
    return (keyframe: Keyframe) =>
      (animation.effect as KeyframeEffect).setKeyframes([keyframe, keyframe]);
  };
  const setPage = hold(lifting ? '::view-transition-old(root)' : '::view-transition-new(root)');
  const setFlap = hold('::view-transition-new(xray-flap)');
  const setShade = hold('::view-transition-new(xray-shade)');

  let point = constrain(width, from);
  let motion: Motion | null = null;
  let arrive: (() => void) | null = null;
  let frame = 0;

  function draw() {
    const pose = poseStyles(poseFor(width, height, point), length);
    setPage(pose.page);
    setFlap(pose.flap);
    setShade(pose.shade);
  }
  function tick(now: number) {
    frame = 0;
    if (ended) return;
    if (motion) {
      const step = motion(now);
      point = step.point;
      if (step.done) {
        motion = null;
        arrive?.();
      } else schedule();
    }
    draw();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  draw();

  return {
    width,
    height,
    lost,
    to(next) {
      point = constrain(width, next);
      // Taking the corner from a motion ends it, so whoever awaits that run is never left waiting.
      if (motion) {
        motion = null;
        arrive?.();
      }
      schedule();
    },
    run(next) {
      motion = next;
      arrive?.();
      schedule();
      return new Promise((resolve) => (arrive = resolve));
    },
    end() {
      ended = true;
      cancelAnimationFrame(frame);
      arrive?.();
      transition.skipTransition();
    },
  };
}

interface PeelOptions {
  /** True to lift the page off (X-ray on), false to lay it back down. */
  lifting: boolean;
  /** Changes the page: called inside the transition, between the two snapshots. */
  update: () => void;
}

/**
 * The scripted peel, for the toggle and X: the corner is pulled from its place to past the
 * bottom-left corner, or laid back from there. Under reduced motion, or where the browser can't
 * peel, `update` runs at once. Resolves once the page has settled.
 */
export async function peel({ lifting, update }: PeelOptions): Promise<void> {
  if (!canPeel()) {
    update();
    return;
  }
  const corner = cornerOf(innerWidth);
  const away = peeledPoint(innerWidth, innerHeight, diagonal(innerWidth, innerHeight));
  const [from, to] = lifting ? [corner, away] : [away, corner];
  const curl = await startCurl({ lifting, update, from });
  if (!curl) return;
  await Promise.race([curl.run(pull(from, to, performance.now())), curl.lost]);
  curl.end();
}
