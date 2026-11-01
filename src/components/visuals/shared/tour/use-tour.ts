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
  /** Held by the visitor's attention: a mouse over the region, focus in it, or a press. */
  looking: boolean;
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
  /** Share of the region that must be on screen for it to start and count down. */
  threshold?: number;
  /**
   * While true the tour neither starts nor counts down: a diagram holds it until its 3D scene
   * has swapped in (or will not), so the swap never lands mid-step. It lapses after
   * `TOUR_HOLD_MAX_MS` of waiting, so a slow scene never stalls the tour.
   */
  hold?: boolean;
}

/** How long a tour shows the overview it opened on before it starts from the first step. */
export const TOUR_OVERVIEW_MS = 1500;
/** The longest a tour waits on `hold` before it plays without it. */
export const TOUR_HOLD_MAX_MS = 3000;

/**
 * The one tour every diagram uses: a single pass from the first step to the last, following the
 * APG carousel rules. It counts down only while `threshold` of the region is on screen and the
 * page can be seen; it holds while a mouse hovers the region, focus is inside it or a pointer is
 * pressed in it (a drag to orbit a scene); it stops for good when the visitor picks a step or
 * focuses a tab, and it never starts under reduced motion. Before it starts and after it ends it
 * shows the last step: the state the server renders, the whole picture.
 *
 * Every tour starts the same way. If the region is out of sight when the controller loads (the
 * usual scroll down the home page), it resets to the first step there, where nobody sees the
 * change, and starts once it is `threshold` on screen. If it is already on screen (a case study's
 * opening diagram, a jump to it, Back), the whole picture the visitor is looking at stays; once
 * they have arrived (on screen, not held, and any 3D scene in) it shows for a beat more and then
 * opens on the first step, so the start reads as a start rather than a glitch.
 */
export function useTour({
  steps,
  dwellMs = TOUR_DWELL_MS,
  threshold = 0.5,
  hold = false,
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
  const [holdLapsed, setHoldLapsed] = useState(false);
  // Counts presses of the control, so a restarted step restarts its progress bar.
  const [runs, setRuns] = useState(0);
  // Time left on a step when the tour is held part-way through it.
  const remaining = useRef<{ step: number; ms: number } | null>(null);
  // Whether the observer's first report has decided how the tour starts.
  const decided = useRef(false);

  const looking = hovered || focused || pressed;
  const held = hold && !holdLapsed;

  const visible = useInView(ref, {
    threshold,
    onChange(enough) {
      // Reset out of sight: it starts as it comes far enough into view.
      if (enough && playback === 'ready' && step === 0 && !held && !looking && pageVisible) {
        setPlayback('playing');
      }
    },
  });
  useInView(ref, {
    onChange(inView) {
      if (decided.current) return;
      decided.current = true;
      if (playback !== 'idle' || reducedMotion) return;
      // Never move the selection under someone who is already using the tabs.
      if (ref.current?.contains(document.activeElement)) return;
      // Out of sight, start from the first step; on screen, from the whole picture on show.
      if (!inView) setStep(0);
      setPlayback('ready');
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

  // Everything but the visitor's own choice allows it to move now.
  const free = visible && pageVisible && !looking && !reducedMotion;
  const running = playback === 'playing' && free && !held;
  const duration = typeof dwellMs === 'number' ? dwellMs : dwellMs(step);

  // A hold waits only so long once the tour could otherwise move.
  useEffect(() => {
    if (!hold || holdLapsed || !free || (playback !== 'ready' && playback !== 'playing')) return;
    const timer = window.setTimeout(() => setHoldLapsed(true), TOUR_HOLD_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [hold, holdLapsed, free, playback]);

  // Ready: start once the visitor has arrived (or the hold or their look has ended). A tour reset
  // out of sight starts at once; one still showing the whole picture keeps it a beat first.
  useEffect(() => {
    if (playback !== 'ready' || !free || held) return;
    const overview = step === last && last > 0;
    const timer = window.setTimeout(
      () => {
        if (overview) setStep(0);
        setPlayback('playing');
      },
      overview ? TOUR_OVERVIEW_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [playback, free, held, step, last]);

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
    looking,
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
