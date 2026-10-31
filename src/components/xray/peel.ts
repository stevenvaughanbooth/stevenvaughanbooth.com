/**
 * The peel: turning X-ray on lifts the page from its top-right corner, by the toggle, and folds
 * it back across the screen to show the blueprint underneath; turning it off lays it back down.
 *
 * It is one view transition of type "xray". The page as it was is the old snapshot, clipped to
 * the part not yet lifted. Two helper elements exist only for the transition, each with a
 * view-transition-name of its own so they draw above both snapshots: the flap (the back of the
 * lifted sheet, shaded like paper that curls at the fold) and the shade (the shadow the lifted
 * edge casts on the blueprint). The fold runs at 45° and sweeps from the corner to the far one,
 * so every shape is a polygon whose corners move in straight lines between a few keyframes, and
 * the whole sweep runs on the compositor as clip-path and transform animations.
 *
 * Laying the page back down is the same motion in reverse, with the restored page on top.
 */

type Point = readonly [x: number, y: number];

/** Into the page from the top-right corner, at 45°. */
const into: Point = [-Math.SQRT1_2, Math.SQRT1_2];

/** How far the flap reaches past the fold, as a share of what has been lifted: <1 reads as lifted. */
export const FLAP_REACH = 0.82;

/** Helpers are drawn at a quarter size and scaled up: their gradients are smooth anyway. */
const SCALE = 4;

const DURATION = 900;
const EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';

export interface PeelShapes {
  /** What is still lying flat, as a 7-point polygon in viewport pixels. */
  page: Point[];
  /** The flap: the lifted part folded back over the page, as a 5-point polygon. */
  flap: Point[];
}

/**
 * The page and the flap once the fold has travelled `s` pixels into a `width` × `height` viewport
 * from its top-right corner. Each polygon keeps its number of points at every `s` (some coincide),
 * so the browser can interpolate between any two of them.
 */
export function peelShapes(width: number, height: number, s: number): PeelShapes {
  const reach = s * Math.SQRT2;
  // Where the fold crosses the edges, or the corner it has passed.
  const top: Point = [Math.max(0, width - reach), 0];
  const left: Point = reach <= width ? top : [0, Math.min(height, reach - width)];
  const right: Point = [width, Math.min(height, reach)];
  const bottom: Point = reach <= height ? right : [Math.max(0, width + height - reach), height];
  const lifted: Point[] = [[width, 0], top, left, bottom, right];
  // Each lifted point folds over the line, landing short of its mirror image.
  const depth = (point: Point) => (point[0] - width) * into[0] + point[1] * into[1];
  const flap = lifted.map(([x, y]): Point => {
    const travel = (1 + FLAP_REACH) * (s - depth([x, y]));
    return [x + travel * into[0], y + travel * into[1]];
  });
  return { page: [top, [0, 0], [0, height], [width, height], right, bottom, left], flap };
}

/** The fold's distance at the end of the sweep, and where the polygons change shape on the way. */
export function peelStops(width: number, height: number): number[] {
  const stops = [0, Math.min(width, height), Math.max(width, height), width + height];
  return [...new Set(stops)].map((reach) => reach / Math.SQRT2);
}

const polygon = (points: readonly Point[], shift: Point = [0, 0], scale = 1) =>
  `polygon(${points
    .map(([x, y]) => `${(x - shift[0]) / scale}px ${(y - shift[1]) / scale}px`)
    .join(', ')})`;

/** The colours of the sheet's back and its shadow, for the theme the page is leaving or entering. */
function paper(dark: boolean) {
  return dark
    ? { crease: '#7a8494', roll: '#1b1f26', sheen: '#2d333d', back: '#1d2128', tip: '#121418' }
    : { crease: '#ffffff', roll: '#deded6', sheen: '#f3f3ee', back: '#e6e6df', tip: '#cfcfc6' };
}

/**
 * A helper: a square of side width + height, centred on the viewport, so that sliding it along the
 * fold always covers the flap. It is drawn at a quarter size and scaled up. Its gradient runs at
 * 225° (into the page), and `fold` is how far along it the fold sits at the start.
 */
function helper(name: string, width: number, height: number, background: (fold: number) => string) {
  const side = width + height;
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.xrayPeel = name;
  const fold = side / (2 * Math.SQRT2) / SCALE;
  Object.assign(element.style, {
    position: 'fixed',
    left: `${-height / 2}px`,
    top: `${-width / 2}px`,
    width: `${side / SCALE}px`,
    height: `${side / SCALE}px`,
    transformOrigin: '0 0',
    transform: `scale(${SCALE})`,
    pointerEvents: 'none',
    viewTransitionName: name,
    background: background(fold),
  });
  return element;
}

const px = (value: number) => `${value / SCALE}px`;

function helpers(width: number, height: number, dark: boolean) {
  const { crease, roll, sheen, back, tip } = paper(dark);
  const flap = helper(
    'xray-flap',
    width,
    height,
    (fold) =>
      `linear-gradient(225deg, transparent ${fold}px, ${crease} ${fold}px, ${roll} calc(${fold}px + ${px(22)}), ${sheen} calc(${fold}px + ${px(70)}), ${back} calc(${fold}px + ${px(320)}), ${tip} 100%)`,
  );
  const shade = helper(
    'xray-shade',
    width,
    height,
    (fold) =>
      `linear-gradient(225deg, transparent calc(${fold}px - ${px(90)}), rgb(2 10 24 / 0.18) calc(${fold}px - ${px(28)}), rgb(2 10 24 / 0.5) ${fold}px, transparent ${fold}px)`,
  );
  return { flap, shade };
}

interface PeelOptions {
  /** True to lift the page off (X-ray on), false to lay it back down. */
  lifting: boolean;
  /** Changes the page: called inside the transition, between the two snapshots. */
  update: () => void;
}

/** Whether this browser can run the peel: typed view transitions scope its CSS to it. */
export function canPeel(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    CSS.supports('selector(:active-view-transition-type(xray))') &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Runs `update` inside the peel, or at once where the browser can't peel or the visitor prefers
 * reduced motion. Resolves once the page has changed, before the animation ends.
 */
export function peel({ lifting, update }: PeelOptions): Promise<void> {
  if (!canPeel()) {
    update();
    return Promise.resolve();
  }
  const width = innerWidth;
  const height = innerHeight;
  const root = document.documentElement;
  // The sheet is the normal page, so its back takes the visitor's theme.
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
    ? root.dataset.theme !== 'light'
    : root.dataset.theme === 'dark';
  const { flap, shade } = helpers(width, height, dark);

  const transition = document.startViewTransition({
    update() {
      document.body.append(shade, flap);
      update();
    },
    types: ['xray', lifting ? 'xray-lift' : 'xray-lay'],
  });
  // Animations on pseudo-elements outlive their transition (they fill forwards), and the next
  // transition's pseudo-elements would pick them up: they go with the helpers.
  const animations: Animation[] = [];
  const remove = () => {
    shade.remove();
    flap.remove();
    for (const animation of animations) animation.cancel();
  };
  transition.finished.then(remove, remove);

  transition.ready.then(
    () => {
      const stops = peelStops(width, height);
      const end = stops.at(-1) ?? 1;
      const frames = stops.map((s) => ({ s, offset: s / end, ...peelShapes(width, height, s) }));
      const slide = (s: number) => `translate(${px(s * into[0])}, ${px(s * into[1])})`;
      const origin: Point = [-height / 2, -width / 2];
      const timing: KeyframeAnimationOptions = {
        duration: DURATION,
        easing: EASING,
        fill: 'both',
        direction: lifting ? 'normal' : 'reverse',
      };
      const animate = (pseudoElement: string, keyframes: Keyframe[]) =>
        animations.push(root.animate(keyframes, { ...timing, pseudoElement }));

      animate(
        lifting ? '::view-transition-old(root)' : '::view-transition-new(root)',
        frames.map(({ offset, page }) => ({ offset, clipPath: polygon(page) })),
      );
      animate(
        '::view-transition-new(xray-flap)',
        frames.map(({ offset, s, flap: shape }) => {
          const shift: Point = [origin[0] + s * into[0], origin[1] + s * into[1]];
          return { offset, transform: slide(s), clipPath: polygon(shape, shift, SCALE) };
        }),
      );
      animate(
        '::view-transition-new(xray-shade)',
        frames.map(({ offset, s }) => ({ offset, transform: slide(s) })),
      );
    },
    () => {
      // The transition was skipped (another started, or the page was hidden): nothing to animate.
    },
  );

  return transition.updateCallbackDone;
}
