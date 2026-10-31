import type { Accent } from '@/content/profile';
import { StepControls } from '../step-controls';
import { type TourPlayback, type TourWording, tourStatus } from './wording';

interface TourControlsProps {
  accent: Accent;
  playback: TourPlayback;
  /** Whether the tour is counting down: lights the status dot. */
  running: boolean;
  wording: TourWording;
  /** Omitted in the static server render, which has no behaviour. */
  onToggle?: () => void;
}

/**
 * Every tour's footer: its status on the left and one Play / Pause / Replay control on the right
 * (WCAG 2.2.2). The server renders it at rest; the controller renders it live.
 */
export function TourControls({ accent, playback, running, wording, onToggle }: TourControlsProps) {
  const { status, action } = tourStatus(playback, running, wording);
  return (
    <StepControls
      status={status}
      accent={accent}
      live={running}
      action={{ ...action, onClick: onToggle }}
    />
  );
}
