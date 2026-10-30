import { type RefObject, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';

/*
 * Server-snapshot policy, shared by every hook here: on the server and during hydration each
 * hook reports the motionless state (reduced motion on, page hidden, element out of view). The
 * prerendered HTML is therefore always the static state, and nothing moves until the browser has
 * confirmed that it may.
 */

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether the visitor asks for reduced motion. True on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Whether the browser tab is in the foreground. False on the server. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => false,
  );
}

export interface InViewOptions {
  /** Share of the element that must be on screen, from 0 (any of it) to 1 (all of it). */
  threshold?: number;
  /** Grows the viewport before testing, e.g. '200px 0px' to report an element before it arrives. */
  rootMargin?: string;
  /** Stop observing the first time the element is in view. */
  once?: boolean;
  /** Called from the observer each time the result changes, including the first report. */
  onChange?: (inView: boolean) => void;
}

/**
 * Whether the element is in view, from an IntersectionObserver. False on the server and until
 * the observer's first report. Without IntersectionObserver it never reports.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { threshold = 0, rootMargin = '0px', once = false, onChange }: InViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);
  const changed = useEffectEvent((next: boolean) => onChange?.(next));

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let last: boolean | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        // Ratios reported at a crossing can land a hair under the threshold.
        const next = entry.isIntersecting && entry.intersectionRatio >= threshold - 0.01;
        if (next === last) return;
        last = next;
        setInView(next);
        changed(next);
        if (next && once) observer.disconnect();
      },
      { rootMargin, threshold: threshold > 0 ? [0, threshold] : 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin, once]);

  return inView;
}
