import type { StepAction } from '../step-controls';

/*
 * What every tour's footer says, shared by the server's static render and the controllers. It
 * holds no hooks, so a Server Component can render a tour's resting footer from it.
 */

/** How long each step of a guided tour stays on screen, the same for every diagram. */
export const TOUR_DWELL_MS = 6000;

/**
 * idle: not started; rests on its rest step (the static card's state).
 * ready: reset out of sight to the first step, waiting to be seen (the Adage replay).
 * playing: touring the steps (it may be held: off screen, tab hidden, hovered, focused, pressed).
 * paused: stopped by the visitor; only the play control restarts it.
 * done: reached the last step and rests there.
 */
export type TourPlayback = 'idle' | 'ready' | 'playing' | 'paused' | 'done';

/** The words that differ between tours. Everything else is the same for all of them. */
export interface TourWording {
  /** The status while it counts down, e.g. 'Auto-advancing'. */
  running: string;
  /** The status at rest, before it starts and after it ends, e.g. 'Full loop'. */
  rest: string;
  /** Completes the control's accessible name after its visible label, e.g. 'auto-advance'. */
  object: string;
}

/** The guided tours' wording; `rest` is each diagram's own. */
export const guidedTour = (rest: string): TourWording => ({
  running: 'Auto-advancing',
  rest,
  object: 'auto-advance',
});

function action(label: 'Play' | 'Pause' | 'Replay', wording: TourWording): StepAction {
  const icon = label === 'Pause' ? 'pause' : label === 'Replay' ? 'replay' : 'play';
  return { label, icon, name: `${label} ${wording.object}` };
}

/** The footer's status text and its one control, for a playback state. */
export function tourStatus(playback: TourPlayback, running: boolean, wording: TourWording) {
  switch (playback) {
    case 'playing':
      return {
        status: running ? wording.running : 'Paused while you look',
        action: action('Pause', wording),
      };
    case 'paused':
      return { status: 'Paused', action: action('Play', wording) };
    case 'ready':
      return { status: 'Ready', action: action('Play', wording) };
    case 'done':
      return { status: wording.rest, action: action('Replay', wording) };
    case 'idle':
      return { status: wording.rest, action: action('Play', wording) };
  }
}
