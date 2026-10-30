'use client';

import { type MouseEvent, type ReactNode, useRef } from 'react';

interface ScenesDialogProps {
  /** Names the dialog: the id of its heading, inside `children`. */
  labelledBy: string;
  /** The dialog's content, rendered on the server. A `<form method="dialog">` button closes it. */
  children: ReactNode;
}

/** A press on the backdrop: the click lands on the dialog itself, outside its box. */
function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  const inside =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom;
  if (!inside) dialog.close();
}

/**
 * The film's text alternative, as a modal dialog. showModal() makes the page behind it inert,
 * moves focus inside, closes on Escape and returns focus to this button. Only the button and
 * the backdrop press are client code; the scenes themselves stay in the server's HTML.
 */
export function ScenesDialog({ labelledBy, children }: ScenesDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="label mt-4 inline-flex min-h-6 cursor-pointer items-center gap-2 rounded transition-colors hover:text-fg"
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
        ref={dialog}
        aria-labelledby={labelledBy}
        onClick={onBackdrop}
        className="m-auto max-h-[calc(100dvh-2.5rem)] w-[min(34rem,calc(100vw-2.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-6 text-fg shadow-card transition-[opacity,translate] duration-200 backdrop:bg-bg/70 backdrop:backdrop-blur-sm sm:p-8 starting:open:translate-y-2 starting:open:opacity-0"
      >
        {children}
      </dialog>
    </>
  );
}
