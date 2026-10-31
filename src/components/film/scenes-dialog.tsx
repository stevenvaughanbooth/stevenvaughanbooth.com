import type { ReactNode } from 'react';
import { opensScenes } from './theater';

interface ScenesDialogProps {
  /** Names the dialog: the id of its heading, inside `children`. */
  labelledBy: string;
  /** The dialog's content. A `<form method="dialog">` button closes it. */
  children: ReactNode;
}

/**
 * The film's text alternative, as a modal dialog opened from the theater. It has no code of its
 * own: the theater's shell opens it from this button and closes it on a press on its backdrop
 * (arrival-shell.tsx). showModal() makes the theater behind it inert, moves focus inside, closes
 * on Escape and returns focus to this button.
 */
export function ScenesDialog({ labelledBy, children }: ScenesDialogProps) {
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        {...opensScenes}
        className="label inline-flex min-h-6 shrink-0 cursor-pointer items-center gap-2 rounded transition-colors hover:text-fg"
      >
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        Scene by scene
      </button>
      <dialog
        aria-labelledby={labelledBy}
        className="m-auto max-h-[calc(100dvh-2.5rem)] w-[min(34rem,calc(100vw-2.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-6 text-fg shadow-card transition-[opacity,translate] duration-200 backdrop:bg-bg/70 backdrop:backdrop-blur-sm sm:p-8 starting:open:translate-y-2 starting:open:opacity-0"
      >
        {children}
      </dialog>
    </>
  );
}
