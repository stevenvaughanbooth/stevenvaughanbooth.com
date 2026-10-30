import type { StepAction } from '../shared/step-controls';
import type { Playback } from '../shared/use-auto-advance';

/*
 * What the tabs and footer say, shared by the server's static render and the controller (and
 * kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Stages of the multiplier loop';

const actions: Record<Playback, StepAction> = {
  idle: { label: 'Play', icon: 'play', name: 'Play auto-advance' },
  playing: { label: 'Pause', icon: 'pause', name: 'Pause auto-advance' },
  paused: { label: 'Play', icon: 'play', name: 'Play auto-advance' },
  done: { label: 'Replay', icon: 'replay', name: 'Replay auto-advance' },
};

/** The footer's status text and play control for a playback state. */
export function tourControls(playback: Playback, running: boolean) {
  const status =
    playback === 'playing'
      ? running
        ? 'Auto-advancing'
        : 'Paused while you look'
      : playback === 'paused'
        ? 'Paused'
        : 'Full loop';
  return { status, action: actions[playback] };
}
