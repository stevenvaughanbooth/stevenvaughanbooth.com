import type { ReactNode } from 'react';
import type { Accent } from '@/content/profile';
import { visualAccent } from './accent';

interface VisualFrameProps {
  /** Base id; the title is `${id}-title`. */
  id: string;
  title: string;
  accent: Accent;
  children: ReactNode;
  footer?: ReactNode;
  /** Classes for the footer row, e.g. `motion-reduce:hidden` for playback-only controls. */
  footerClassName?: string;
}

/**
 * The card every visual sits in: a header with the accent dot, the title and the one
 * 'Illustrative' tag; the body; and an optional footer row for StepControls. It is also the
 * container that the visuals' container queries measure.
 */
export function VisualFrame({
  id,
  title,
  accent,
  children,
  footer,
  footerClassName = '',
}: VisualFrameProps) {
  return (
    <div
      role="group"
      // A label of its own rather than one pointing into the title: a visually hidden span inside
      // the title made screen readers say "Session replay , illustrative".
      aria-label={`${title}, illustrative`}
      className="@container rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p id={`${id}-title`} className="label flex items-center gap-2">
          <span aria-hidden className={`size-1.5 rounded-full ${visualAccent[accent].dot}`} />
          {title}
        </p>
        <p aria-hidden className="label rounded-full border border-line px-2 py-0.5">
          Illustrative
        </p>
      </div>
      <div className="mt-4">{children}</div>
      {footer ? (
        <div className={`mt-5 border-t border-line pt-4 ${footerClassName}`}>{footer}</div>
      ) : null}
    </div>
  );
}
