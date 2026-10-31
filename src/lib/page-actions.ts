/**
 * Performs a page action from Ask Steven: shows the visitor one target from the allowlist in
 * page-targets.ts. An in-page target scrolls into view, takes keyboard focus, and its heading (or
 * card) pulses once in the accent colour; a career role also opens its disclosure. A case study is
 * a page of its own, so it navigates there. Anything outside the allowlist does nothing.
 *
 * Browser-only, and loaded with the palette. It never runs on its own: the palette calls it when
 * the visitor presses "Show me", or asks outright to be shown something.
 */
import type { Route } from 'next';
import { type PageTarget, pageTarget, placeOn } from './page-targets';

export interface PageActionOptions {
  /** Client-side navigation (the router's push), for targets that are not on this page. */
  navigate: (href: Route) => void;
}

const PULSE_MS = 1800;
/** A scroll counts as finished once no scroll event has arrived for this long. */
const SETTLE_MS = 120;

let running: Animation | undefined;
/** Cancels the wait of an action still scrolling, so only the latest one pulses. */
let waiting: (() => void) | undefined;

/** Runs `then` once any scrolling has stopped, without relying on `scrollend` support. */
function afterScroll(then: () => void) {
  waiting?.();
  let timer = window.setTimeout(done, SETTLE_MS);
  function onScroll() {
    window.clearTimeout(timer);
    timer = window.setTimeout(done, SETTLE_MS);
  }
  function stop() {
    window.clearTimeout(timer);
    window.removeEventListener('scroll', onScroll);
    waiting = undefined;
  }
  function done() {
    stop();
    then();
  }
  waiting = stop;
  window.addEventListener('scroll', onScroll, { passive: true });
}

const isRounded = (element: Element) =>
  parseFloat(getComputedStyle(element).borderTopLeftRadius) > 0;

/**
 * One calm ring in the accent colour, drawn with `outline` so nothing moves or reflows. With
 * reduced motion it only fades in and out; otherwise it also settles inward as it appears.
 */
function pulse(element: HTMLElement) {
  if (typeof element.animate !== 'function') return;
  running?.cancel();
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The outline follows border-radius, so give square elements (headings) soft corners for it.
  const square = !isRounded(element);
  const ring = (color: string, offset: number, at: number): Keyframe => ({
    offset: at,
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineColor: color,
    outlineOffset: `${offset}px`,
    ...(square ? { borderRadius: '0.75rem' } : {}),
  });
  const accent = 'color-mix(in oklab, var(--green) 70%, transparent)';
  running = element.animate(
    [
      ring('transparent', still ? 6 : 14, 0),
      ring(accent, 6, 0.25),
      ring(accent, 6, 0.6),
      ring('transparent', 6, 1),
    ],
    { duration: PULSE_MS, easing: 'ease-out' },
  );
}

/**
 * Scrolls an element to the top of the view (under the fixed header) or to its middle. It measures
 * layout offsets, which ignore transforms: a section still rising into place on its scroll-driven
 * reveal sits 24px lower than it will once there, and scrollIntoView would stop short of it.
 */
function scrollToElement(element: HTMLElement, block: 'start' | 'center') {
  let top = 0;
  for (let node: Element | null = element; node instanceof HTMLElement; node = node.offsetParent) {
    top += node.offsetTop;
  }
  const header = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const y =
    block === 'start'
      ? top - header
      : top + element.offsetHeight / 2 - (window.innerHeight + header) / 2;
  window.scrollTo({ top: Math.max(0, Math.round(y)) });
}

/** Focuses an element, making a heading focusable first, without scrolling a second time. */
function focus(element: HTMLElement) {
  if (!element.matches('a[href], button, summary, input, select, textarea, [tabindex]')) {
    element.setAttribute('tabindex', '-1');
  }
  element.focus({ preventScroll: true });
}

function reveal(element: HTMLElement, target: PageTarget) {
  if (target.kind === 'role') {
    const details = element.querySelector('details');
    const summary = details?.querySelector('summary');
    if (details && summary) {
      // Roles share one name, so opening this one closes the others.
      details.open = true;
      // The step chart on wide screens (the summary's positioned container), the rung on phones.
      const frame = summary.offsetParent instanceof HTMLElement ? summary.offsetParent : element;
      scrollToElement(frame, 'center');
      focus(summary);
      afterScroll(() => pulse(summary));
      return;
    }
  }

  const heading = element.matches('h2, h3')
    ? element
    : (element.querySelector<HTMLElement>('h2, h3') ?? element);
  scrollToElement(element, 'start');
  focus(heading);
  // A card (the awards) rings as a whole; a section or a theme rings its heading.
  afterScroll(() => pulse(isRounded(element) ? element : heading));
}

/**
 * Shows a target. Returns false, and does nothing, for an id outside the allowlist. Scrolling
 * follows the page's own `scroll-behavior`, which is smooth unless reduced motion is preferred.
 */
export function showOnPage(id: unknown, { navigate }: PageActionOptions): boolean {
  const target = pageTarget(id);
  if (!target) return false;
  const place = placeOn(target, window.location.pathname);
  const element = place ? document.getElementById(place.anchor) : null;
  if (!place || !element) {
    // A case study, or a home page target seen from another page. The route type cannot know
    // pages that are generated from content, so the allowlist vouches for the href instead.
    navigate(target.href as Route);
    return true;
  }
  window.history.pushState(null, '', place.href);
  reveal(element, target);
  return true;
}
