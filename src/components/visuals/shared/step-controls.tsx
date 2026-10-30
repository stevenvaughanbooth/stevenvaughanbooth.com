import type { Accent } from '@/content/profile';
import { visualAccent } from './accent';
import { NextIcon, PauseIcon, PlayIcon, ReplayIcon } from './icons';

const icons = { play: PlayIcon, pause: PauseIcon, replay: ReplayIcon, next: NextIcon };

export interface StepAction {
  /** Visible text. */
  label: string;
  icon: keyof typeof icons;
  /** A fuller accessible name; it must start with the visible label (WCAG 2.5.3). */
  name?: string;
  /** Omitted in the static server render. */
  onClick?: () => void;
}

interface StepControlsProps {
  status: string;
  accent: Accent;
  /** Shows a status dot, lit in the accent colour while true. */
  live?: boolean;
  action: StepAction;
}

/**
 * The footer row every stepped visual shares: status text on the left, one pill button on the
 * right. A forward arrow trails its label; playback icons lead.
 */
export function StepControls({ status, accent, live, action }: StepControlsProps) {
  const Icon = icons[action.icon];
  const trailing = action.icon === 'next';
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="label flex items-center gap-2">
        {live === undefined ? null : (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full transition-colors ${live ? visualAccent[accent].dot : 'bg-line-strong'}`}
          />
        )}
        {status}
      </p>
      <button
        type="button"
        onClick={action.onClick}
        aria-label={action.name}
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line px-3.5 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        {trailing ? null : <Icon />}
        {action.label}
        {trailing ? <Icon /> : null}
      </button>
    </div>
  );
}
