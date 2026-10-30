import type { StepAction } from '../shared/step-controls';

/*
 * What the footer says, shared by the server's static render and the controller (and kept out
 * of view.tsx, which ships in the initial page).
 */

/**
 * idle: the controller has loaded and shows the finished session, as the server did.
 * ready: reset off screen, waiting to play as the card scrolls in.
 * playing: replaying the session.
 * done: the replay finished or was skipped, and rests on the finished session.
 */
export type ReplayStatus = 'idle' | 'ready' | 'playing' | 'done';

const finished = {
  status: 'Full session',
  action: { label: 'Replay', icon: 'replay', name: 'Replay the session' },
} as const;

const controls: Record<ReplayStatus, { status: string; action: StepAction }> = {
  idle: finished,
  ready: { status: 'Ready', action: { label: 'Play', icon: 'play', name: 'Play the session' } },
  playing: {
    status: 'Replaying',
    action: { label: 'Skip', icon: 'next', name: 'Skip to the end of the session' },
  },
  done: finished,
};

/** The footer's status text and its one control for a replay state. */
export function replayControls(status: ReplayStatus) {
  return controls[status];
}
