/**
 * When the hero's frame may play the film by itself. The portrait is the first thing the hero
 * paints and stays the page's LCP element: the film is considered only after the load event and
 * an idle period, and only when nothing argues against it. Anyone can still play it from the chip.
 */

/** From md the frame is a 240px column or wider. Below it the portrait is an 88px avatar. */
export const frameQuery = '(min-width: 48rem)';

const motionQuery = '(prefers-reduced-motion: no-preference)';
// Chromium only, behind a flag today; elsewhere it never matches.
const reducedDataQuery = '(prefers-reduced-data: reduce)';
const seenKey = 'arrival:seen';

/** The Network Information API, where the browser has it (Chromium); TypeScript's DOM lacks it. */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

type Env = Pick<Window, 'matchMedia' | 'navigator' | 'sessionStorage'>;

/** A big enough frame, motion welcome, data not scarce, and not already played this visit. */
export function mayPlayInFrame(env: Env): boolean {
  if (!env.matchMedia(frameQuery).matches || !env.matchMedia(motionQuery).matches) return false;
  if (env.matchMedia(reducedDataQuery).matches) return false;
  const { connection } = env.navigator as Navigator & { connection?: NetworkInformation };
  if (connection?.saveData || connection?.effectiveType?.endsWith('2g')) return false;
  return !hasPlayed(env);
}

function hasPlayed(env: Pick<Window, 'sessionStorage'>): boolean {
  try {
    return env.sessionStorage.getItem(seenKey) !== null;
  } catch {
    // Storage can be unavailable (some privacy modes): then it may play on every visit.
    return false;
  }
}

/** Remembers, for this tab's session, that the frame has played the film. */
export function markPlayed(env: Pick<Window, 'sessionStorage'>) {
  try {
    env.sessionStorage.setItem(seenKey, '1');
  } catch {
    // As above: nothing to remember it in.
  }
}

/**
 * Calls back once the page has loaded and the main thread is idle; returns a cancel function.
 * Safari has no requestIdleCallback, so there the next task after load stands in for idle.
 */
export function whenSettled(win: Window, callback: () => void): () => void {
  let cancelIdle = () => {};
  const schedule = () => {
    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(() => callback());
      cancelIdle = () => win.cancelIdleCallback(handle);
    } else {
      const handle = win.setTimeout(callback);
      cancelIdle = () => win.clearTimeout(handle);
    }
  };
  if (win.document.readyState === 'complete') schedule();
  else win.addEventListener('load', schedule, { once: true });
  return () => {
    win.removeEventListener('load', schedule);
    cancelIdle();
  };
}
