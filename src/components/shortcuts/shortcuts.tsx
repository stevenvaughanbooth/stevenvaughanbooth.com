'use client';

import { Activity, type ComponentProps, type ComponentType, useEffect, useState } from 'react';
import { startQuestion } from '../ask/ask-events';
import { switchTheme, themeToggleId } from '../theme-toggle';
import { characterKeysEnabled, sheetId, shortcutFor } from './keys';
import type { ShortcutsSheetProps } from './shortcuts-sheet';

const SHORTCUTS_OPEN_EVENT = 'shortcuts:open';

const loadSheet = () => import('./shortcuts-sheet');

function warm() {
  loadSheet().catch(() => {
    // A failed prefetch is retried when the sheet is actually opened.
  });
}

/** Opens the shortcuts sheet, loading it first if need be. */
export function openShortcuts(): void {
  window.dispatchEvent(new Event(SHORTCUTS_OPEN_EVENT));
}

/** A modal dialog other than the sheet (the Ask palette, say) has the keyboard. */
const otherModalOpen = () => document.querySelector(`dialog:modal:not(#${sheetId})`) !== null;

/** Any modal dialog, the sheet included, has the keyboard. */
const anyModalOpen = () => document.querySelector('dialog:modal') !== null;

const sheetElement = () => document.getElementById(sheetId) as HTMLDialogElement | null;

/**
 * Listens for the single-key shortcuts: / starts a question (the hero's ask bar while it is in
 * view, Ask Steven elsewhere), T switches the theme, and ? opens or closes the shortcuts sheet,
 * whose code loads only then. Once loaded, the sheet stays mounted under <Activity>: closed,
 * it is hidden with its effects torn down and its state kept, so it reopens at once.
 */
export function Shortcuts() {
  const [Sheet, setSheet] = useState<ComponentType<ShortcutsSheetProps> | null>(null);
  // Counts the requests to show the sheet; 0 while it is closed.
  const [request, setRequest] = useState(0);

  useEffect(() => {
    // The dialog itself says whether it is open: its close event reaches React a task later.
    function show() {
      if (sheetElement()?.open) return;
      loadSheet().then(
        (module) => {
          setSheet(() => module.ShortcutsSheet);
          setRequest((count) => count + 1);
        },
        () => {
          // The sheet couldn't load; the next press tries again.
        },
      );
    }
    function onKeyDown(event: KeyboardEvent) {
      const action = shortcutFor(event);
      if (!action || !characterKeysEnabled() || otherModalOpen()) return;
      // A question starts on the page, never from behind the open sheet.
      if (action === 'ask' && anyModalOpen()) return;
      event.preventDefault();
      if (action === 'ask') startQuestion();
      else if (action === 'theme') switchTheme(document.getElementById(themeToggleId));
      else if (sheetElement()?.open) sheetElement()?.close();
      else show();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(SHORTCUTS_OPEN_EVENT, show);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(SHORTCUTS_OPEN_EVENT, show);
    };
  }, []);

  if (!Sheet) return null;
  return (
    <Activity mode={request > 0 ? 'visible' : 'hidden'}>
      {/* A close only counts for the request it ends: a newer ? may already be on its way. */}
      <Sheet
        request={request}
        onClose={(closed) => setRequest((count) => (count === closed ? 0 : count))}
      />
    </Activity>
  );
}

/** Opens the shortcuts sheet: the way in for pointer users, and once single keys are off. */
export function ShortcutsButton(props: Omit<ComponentProps<'button'>, 'type' | 'onClick'>) {
  return (
    <button
      {...props}
      type="button"
      aria-haspopup="dialog"
      onPointerEnter={warm}
      onFocus={warm}
      onClick={openShortcuts}
    />
  );
}
