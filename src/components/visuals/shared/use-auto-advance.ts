import {
  type FocusEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useInView, usePageVisible, useReducedMotion } from './hooks';

/**
 * idle: not started; shows the last step, the static end state.
 * playing: touring the steps (it may be held: off screen, tab hidden, hovered or focused).
 * paused: stopped by the visitor; only the play control restarts it.
 * done: the tour reached the last step and rests there.
 */
export type Playback = 'idle' | 'playing' | 'paused' | 'done';

/** Spread onto the element that holds the tabs and panel. */
export interface AutoAdvanceRegion {
  ref: RefObject<HTMLDivElement | null>;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

export interface AutoAdvance {
  step: number;
  playback: Playback;
  /** Whether the current step's timer is counting down right now. */
  running: boolean;
  /** The visitor picked a step: show it and stop for good. */
  select: (index: number) => void;
  /** The play/pause control. Playing from the last step starts the tour again. */
  toggle: () => void;
  region: AutoAdvanceRegion;
}

/**
 * A one-pass guided tour through `steps`, following the APG carousel rules. It starts from the
 * first step as the visual scrolls into view and ends on the last. It only counts down while at
 * least half of the region is on screen and the tab is visible, holds while a mouse hovers the
 * region or focus is inside it, and stops for good once the visitor picks a step or focuses a
 * tab. Under reduced motion it never starts. Before it starts, and after it ends, the last step
 * is shown: the same end state the server renders.
 */
export function useAutoAdvance({
  steps,
  durationMs,
}: {
  steps: number;
  durationMs: number;
}): AutoAdvance {
  const last = steps - 1;
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const [step, setStep] = useState(last);
  const [playback, setPlayback] = useState<Playback>('idle');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Time left on a step when the tour is held part-way through it.
  const remaining = useRef<{ step: number; ms: number } | null>(null);

  const visible = useInView(ref, { threshold: 0.5 });
  useInView(ref, {
    onChange(entered) {
      if (!entered || playback !== 'idle' || reducedMotion) return;
      // Never move the selection under someone who is already using the tabs.
      if (ref.current?.contains(document.activeElement)) return;
      setStep(0);
      setPlayback('playing');
    },
  });

  const running =
    playback === 'playing' && visible && pageVisible && !hovered && !focused && !reducedMotion;

  useEffect(() => {
    if (!running) return;
    const held = remaining.current;
    const ms = held?.step === step ? held.ms : durationMs;
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
  }, [running, step, durationMs, last]);

  function stop() {
    if (playback === 'idle' || playback === 'playing') setPlayback('paused');
  }

  function select(index: number) {
    setStep(index);
    setPlayback('paused');
  }

  function toggle() {
    remaining.current = null;
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
