import type { StepAction } from '../shared/step-controls';
import type { Playback } from '../shared/use-auto-advance';

/*
 * What the tabs and the play control say, shared by the server's static render and the
 * controller (and kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Platform stories';

const actions: Record<Playback, StepAction> = {
  idle: { label: 'Play', icon: 'play', name: 'Play auto-advance' },
  playing: { label: 'Pause', icon: 'pause', name: 'Pause auto-advance' },
  paused: { label: 'Play', icon: 'play', name: 'Play auto-advance' },
  done: { label: 'Replay', icon: 'replay', name: 'Replay auto-advance' },
};

/** The status text and play control for a playback state, on the given story. */
export function tourControls(playback: Playback, running: boolean, story: number, count: number) {
  const status =
    playback === 'playing'
      ? running
        ? 'Auto-advancing'
        : 'Paused while you look'
      : playback === 'paused'
        ? 'Paused'
        : `Story ${story + 1} of ${count}`;
  return { status, action: actions[playback] };
}
