import {
  type FocusEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useInView, usePageVisible, useReducedMotion } from '../hooks';
import { TOUR_DWELL_MS, type TourPlayback } from './wording';

/** Spread onto the element that holds the tabs and the panel (or, for a replay, the terminal). */
export interface TourRegion {
  ref: RefObject<HTMLDivElement | null>;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** Progress through the step on show, for a bar: a new key restarts it. */
export interface TourProgress {
  key: string;
  durationMs: number;
  running: boolean;
}

export interface Tour {
  step: number;
  playback: TourPlayback;
  /** Whether the current step's timer is counting down right now. */
  running: boolean;
  /** While playing; null otherwise. */
  progress: TourProgress | null;
  /** The visitor picked a step: show it and stop for good. */
  select: (index: number) => void;
  /** The play/pause control. Playing from the last step starts the tour again. */
  toggle: () => void;
  region: TourRegion;
}

export interface TourOptions {
  steps: number;
  /** How long a step stays on screen, in ms: one value, or one per step. */
  dwellMs?: number | ((step: number) => number);
  /** Share of the region that must be on screen for it to count down. */
  threshold?: number;
  /**
   * enter: starts from the first step as any of the region scrolls into view (the guided tours).
   * unseen: resets to the first step only while the region is out of sight, then starts once it
   * is `threshold` on screen; if it is already on screen when the controller loads, it rests, so
   * nothing vanishes under the reader (the Adage replay).
   */
  start?: 'enter' | 'unseen';
}

/**
 * The one tour every diagram uses: a single pass from the first step to the last, following the
 * APG carousel rules. It counts down only while `threshold` of the region is on screen and the
 * page can be seen; it holds while a mouse hovers the region, focus is inside it or a pointer is
 * pressed in it (a drag to orbit a scene); it stops for good when the visitor picks a step or
 * focuses a tab, and it never starts under reduced motion. Before it starts and after it ends it
 * shows the last step: the state the server renders.
 */
export function useTour({
  steps,
  dwellMs = TOUR_DWELL_MS,
  threshold = 0.5,
  start = 'enter',
}: TourOptions): Tour {
  const last = steps - 1;
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const [step, setStep] = useState(last);
  const [playback, setPlayback] = useState<TourPlayback>('idle');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Counts presses of the control, so a restarted step restarts its progress bar.
  const [runs, setRuns] = useState(0);
  // Time left on a step when the tour is held part-way through it.
  const remaining = useRef<{ step: number; ms: number } | null>(null);
  // Whether the controller's first report has decided how an 'unseen' tour starts.
  const decided = useRef(false);

  const visible = useInView(ref, {
    threshold,
    onChange(enough) {
      if (enough && playback === 'ready') setPlayback('playing');
    },
  });
  useInView(ref, {
    onChange(inView) {
      if (playback !== 'idle' || reducedMotion) return;
      if (start === 'unseen') {
        if (decided.current) return;
        decided.current = true;
        // On screen already: rest on the finished state rather than clear it under the reader.
        if (inView) return;
        setStep(0);
        setPlayback('ready');
        return;
      }
      // Never move the selection under someone who is already using the tabs.
      if (!inView || ref.current?.contains(document.activeElement)) return;
      setStep(0);
      setPlayback('playing');
    },
  });

  // A press ends wherever the pointer is let go, which may be outside the region.
  useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const running =
    playback === 'playing' &&
    visible &&
    pageVisible &&
    !hovered &&
    !focused &&
    !pressed &&
    !reducedMotion;
  const duration = typeof dwellMs === 'number' ? dwellMs : dwellMs(step);

  useEffect(() => {
    if (!running) return;
    const held = remaining.current;
    const ms = held?.step === step ? held.ms : duration;
    const started = performance.now();
    let fired = false;
    const timer = window.setTimeout(() => {
      fired = true;
      setStep(step + 1);
      if (step + 1 === last) setPlayback('done');
    }, ms);
    return () => {
      window.clearTimeout(timer);
      remaining.current = fired
        ? null
        : { step, ms: Math.max(0, ms - (performance.now() - started)) };
    };
  }, [running, step, duration, last]);

  function stop() {
    if (playback === 'idle' || playback === 'ready' || playback === 'playing') {
      setPlayback('paused');
    }
  }

  function select(index: number) {
    remaining.current = null;
    setStep(index);
    setPlayback('paused');
  }

  function toggle() {
    remaining.current = null;
    setRuns(runs + 1);
    if (playback === 'playing') {
      setPlayback('paused');
      return;
    }
    if (step === last) setStep(0);
    setPlayback('playing');
  }

  return {
    step,
    playback,
    running,
    progress:
      playback === 'playing' ? { key: `${step}-${runs}`, durationMs: duration, running } : null,
    select,
    toggle,
    region: {
      ref,
      onPointerEnter(event) {
        if (event.pointerType === 'mouse') setHovered(true);
      },
      onPointerLeave(event) {
        if (event.pointerType === 'mouse') setHovered(false);
      },
      onPointerDown() {
        setPressed(true);
      },
      onFocus(event) {
        setFocused(true);
        if (event.target.getAttribute('role') === 'tab') stop();
      },
      onBlur(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
    },
  };
}
