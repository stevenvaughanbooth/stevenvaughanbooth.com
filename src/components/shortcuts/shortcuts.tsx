'use client';

import { Activity, type ComponentProps, type ComponentType, useEffect, useState } from 'react';
import { startQuestion } from '../ask/ask-events';
import { switchTheme, themeToggleId } from '../theme-toggle';
import { observeInteractions } from '../xray/interactions';
import {
  announceKeys,
  characterKeysEnabled,
  sheetId,
  shortcutFor,
  xrayMark,
  xrayStorageKey,
  xrayWanted,
} from './keys';
import type { ShortcutsSheetProps } from './shortcuts-sheet';

const SHORTCUTS_OPEN_EVENT = 'shortcuts:open';

const loadSheet = () => import('./shortcuts-sheet');
// The HUD tells the page's own downloads from X-ray's, and what came after, by this mark.
const loadXray = () => {
  if (performance.getEntriesByName(xrayMark).length === 0) performance.mark(xrayMark);
  return import('../xray/xray');
};

function warm() {
  loadSheet().catch(() => {
    // A failed prefetch is retried when the sheet is actually opened.
  });
}

const warmXray = () => loadXray().catch(() => {});

/** X-ray's overlay, which the listener renders after the header, and whether it is on. */
export interface XrayView {
  Overlay: ComponentType;
  on: boolean;
}

const onXrayToggle = (event: Event) =>
  event.target instanceof Element && event.target.closest('[data-xray-toggle]') !== null;

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
 * view, Ask Steven elsewhere), T switches the theme, X peels the page back (X-ray), and ? opens
 * or closes the shortcuts sheet, whose code loads only then. Once loaded, the sheet stays mounted
 * under <Activity>: closed, it is hidden with its effects torn down and its state kept, so it
 * reopens at once.
 *
 * It is also X-ray's only code in the initial page: any <button data-xray-toggle> (the header's,
 * and any a page adds) and ?xray in the address turn it on, as does a page loaded in a tab that
 * left it on, and a pointer or focus on a toggle starts its download. Its overlay renders here, after the header, and stays mounted under
 * <Activity> once loaded. The listener starts the interaction log the HUD's INP comes from, too.
 */
export function Shortcuts() {
  const [Sheet, setSheet] = useState<ComponentType<ShortcutsSheetProps> | null>(null);
  // Counts the requests to show the sheet; 0 while it is closed.
  const [request, setRequest] = useState(0);
  // X-ray's overlay, rendered here once loaded, and whether it is showing.
  const [xray, setXray] = useState<XrayView | null>(null);

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
    // If X-ray can't load, the page stays as it is and the next press tries again.
    const toggleXray = () =>
      loadXray().then(
        (loaded) => loaded.toggle(setXray),
        () => {},
      );
    function onKeyDown(event: KeyboardEvent) {
      const action = shortcutFor(event);
      if (!action || !characterKeysEnabled() || otherModalOpen()) return;
      // A question starts, and the page peels back, never from behind the open sheet.
      if ((action === 'ask' || action === 'xray') && anyModalOpen()) return;
      event.preventDefault();
      if (action === 'ask') startQuestion();
      else if (action === 'theme') switchTheme(document.getElementById(themeToggleId));
      else if (action === 'xray') void toggleXray();
      else if (sheetElement()?.open) sheetElement()?.close();
      else show();
    }

    const onIntent = (event: Event) => {
      if (onXrayToggle(event)) warmXray();
    };
    const onClick = (event: Event) => {
      if (onXrayToggle(event)) void toggleXray();
    };
    const onLoad = () => {
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(xrayStorageKey);
      } catch {
        // Without storage, only ?xray turns it on.
      }
      if (xrayWanted(window.location.search, stored)) void toggleXray();
    };

    observeInteractions();
    announceKeys();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(SHORTCUTS_OPEN_EVENT, show);
    document.addEventListener('pointerover', onIntent);
    document.addEventListener('focusin', onIntent);
    document.addEventListener('click', onClick);
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(SHORTCUTS_OPEN_EVENT, show);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('click', onClick);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  return (
    <>
      {xray ? (
        <Activity mode={xray.on ? 'visible' : 'hidden'}>
          <xray.Overlay />
        </Activity>
      ) : null}
      {Sheet ? (
        <Activity mode={request > 0 ? 'visible' : 'hidden'}>
          {/* A close only counts for the request it ends: a newer ? may already be on its way. */}
          <Sheet
            request={request}
            onClose={(closed) => setRequest((count) => (count === closed ? 0 : count))}
          />
        </Activity>
      ) : null}
    </>
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
