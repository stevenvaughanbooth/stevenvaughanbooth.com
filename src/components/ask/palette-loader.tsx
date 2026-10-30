'use client';

import {
  Component,
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Mail } from '@/components/ui/icons';
import { ASK_OPEN_EVENT, ASK_WARM_EVENT, type AskOpenDetail } from './ask-events';
import { Close, Retry } from './ask-icons';
import type { AskPaletteHandle } from './ask-palette';

const loadPalette = () => import('./ask-palette');
// React.lazy remembers a failed import for good, so retrying needs a new lazy component.
const lazyPalette = () =>
  lazy(() => loadPalette().then((module) => ({ default: module.AskPalette })));

/** Lets the region join the accessibility tree (the dialog may have just opened) before it speaks. */
const ANNOUNCE_DELAY_MS = 150;
/** Then clears it, so browse-mode readers don't meet the same text again later in the page. */
const ANNOUNCE_CLEAR_MS = 5000;

function warm() {
  loadPalette().catch(() => {
    // A failed prefetch is retried when the visitor actually opens the palette.
  });
}

function isAskShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'k'
  );
}

/** Keeps a palette that fails to load or render from taking the page down with it. */
class PaletteBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

const action =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-elevated';

interface LoadFailedProps {
  email: string;
  onRetry: () => void;
  onDismiss: () => void;
}

function LoadFailed({ email, onRetry, onDismiss }: LoadFailedProps) {
  const retry = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // The visitor just asked for the palette, so put them on the way forward.
  useEffect(() => {
    retry.current?.focus();
  }, []);

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onDismiss();
  }

  return (
    <section
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-line-strong bg-surface p-4 text-fg shadow-card sm:right-6 sm:bottom-6 sm:left-auto"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-medium">
          Ask Steven couldn’t load.
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          <Close width={16} height={16} />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Check your connection and try again, or email Steven directly.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button ref={retry} type="button" onClick={onRetry} className={action}>
          <Retry width={16} height={16} /> Try again
        </button>
        <a href={`mailto:${email}`} className={action}>
          <Mail width={16} height={16} /> Email Steven
        </a>
      </div>
    </section>
  );
}

/**
 * Listens for ⌘K / Ctrl+K and ASK_OPEN_EVENT, and loads the palette only on intent (a hover,
 * focus or press of an Ask button, or the shortcut), so it costs nothing up front.
 *
 * It also owns the palette's one polite live region. A modal dialog makes the rest of the page
 * inert, which takes any live region outside it out of the accessibility tree, so once the
 * palette exists the region is rendered inside its dialog; until then, and if it fails to load,
 * it sits here in the page.
 */
export function PaletteLoader({ email }: { email: string }) {
  const [requested, setRequested] = useState(false);
  const [Palette, setPalette] = useState(lazyPalette);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const palette = useRef<AskPaletteHandle | null>(null);
  const pending = useRef<AskOpenDetail | null>(null);
  const lastRequest = useRef<{ detail: AskOpenDetail; opener: Element | null }>({
    detail: {},
    opener: null,
  });
  const timers = useRef<{ show?: number; clear?: number }>({});

  function announce(text: string) {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.clear);
    setMessage('');
    if (!text) return;
    // Clearing first also means a repeated message still counts as a change.
    timers.current.show = window.setTimeout(() => {
      setMessage(text);
      timers.current.clear = window.setTimeout(() => setMessage(''), ANNOUNCE_CLEAR_MS);
    }, ANNOUNCE_DELAY_MS);
  }

  useEffect(() => {
    const pendingTimers = timers.current;
    function request(detail: AskOpenDetail) {
      lastRequest.current = { detail, opener: document.activeElement };
      if (palette.current) palette.current.open(detail);
      else {
        pending.current = detail;
        setFailed(false);
        setRequested(true);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isAskShortcut(event) || event.repeat) return;
      event.preventDefault();
      if (palette.current?.isOpen()) palette.current.close();
      else request({});
    }
    function onOpen(event: Event) {
      request((event as CustomEvent<AskOpenDetail>).detail ?? {});
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(ASK_OPEN_EVENT, onOpen);
    window.addEventListener(ASK_WARM_EVENT, warm, { once: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(ASK_OPEN_EVENT, onOpen);
      window.removeEventListener(ASK_WARM_EVENT, warm);
      window.clearTimeout(pendingTimers.show);
      window.clearTimeout(pendingTimers.clear);
    };
  }, []);

  function attach(handle: AskPaletteHandle | null) {
    palette.current = handle;
    if (handle && pending.current) {
      handle.open(pending.current);
      pending.current = null;
    }
  }

  function onError() {
    palette.current = null;
    setRequested(false);
    setFailed(true);
    // The next request, from Try again or any Ask button, starts a fresh import.
    setPalette(() => lazyPalette());
    announce(`Ask Steven couldn’t load. Try again, or email Steven at ${email}.`);
  }

  function restoreFocus() {
    const { opener } = lastRequest.current;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  }

  function retry() {
    // Focus the original button first, so the palette returns focus there when it closes.
    restoreFocus();
    pending.current = lastRequest.current.detail;
    setFailed(false);
    setRequested(true);
  }

  function dismiss() {
    setFailed(false);
    announce('');
    restoreFocus();
  }

  const region = (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  );

  if (!requested) {
    return (
      <>
        {region}
        {failed ? <LoadFailed email={email} onRetry={retry} onDismiss={dismiss} /> : null}
      </>
    );
  }
  return (
    <PaletteBoundary onError={onError}>
      <Suspense fallback={region}>
        <Palette ref={attach} announce={announce}>
          {region}
        </Palette>
      </Suspense>
    </PaletteBoundary>
  );
}
