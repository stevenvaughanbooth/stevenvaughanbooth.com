'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import { type Theme, themeStorageKey } from '@/lib/tokens';

const darkQuery = '(prefers-color-scheme: dark)';

/** The toggle's id, so the T shortcut can start the switch from the button. */
export const themeToggleId = 'theme-toggle';

function currentTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return matchMedia(darkQuery).matches ? 'dark' : 'light';
}

/** The theme changes with the toggle (data-theme) or, without a saved choice, with the system. */
function subscribe(onChange: () => void) {
  const media = matchMedia(darkQuery);
  const observer = new MutationObserver(onChange);
  media.addEventListener('change', onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

const isDark = () => currentTheme() === 'dark';
// The server can't know the theme, so the pressed state is left out until hydration.
const unknown = () => null;

/** Whether the browser can run the theme's own view transition: typed transitions scope its CSS. */
function canReveal(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    CSS.supports('selector(:active-view-transition-type(theme))')
  );
}

let latest: ViewTransition | null = null;

/**
 * Flips light/dark and remembers the choice. Where View Transitions are supported, the new theme
 * is revealed in a circle that grows from `origin` (globals.css animates ::view-transition-new
 * for transitions of type "theme"); otherwise, or under reduced motion, it switches at once.
 */
export function switchTheme(origin?: Element | null) {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  const apply = () => {
    root.dataset.theme = next;
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !canReveal()) {
    apply();
    return;
  }
  const box = origin?.getBoundingClientRect();
  root.style.setProperty('--reveal-x', `${box ? box.left + box.width / 2 : innerWidth / 2}px`);
  root.style.setProperty('--reveal-y', `${box ? box.top + box.height / 2 : 0}px`);
  const transition = document.startViewTransition({ update: apply, types: ['theme'] });
  latest = transition;
  // A quick second switch skips this transition; only the last one clears the origin.
  const clear = () => {
    if (latest !== transition) return;
    latest = null;
    root.style.removeProperty('--reveal-x');
    root.style.removeProperty('--reveal-y');
  };
  transition.finished.then(clear, clear);
}

/**
 * The light/dark switch, which exposes its state as aria-pressed. The icons arrive as
 * server-rendered children, so the icon set stays out of the client bundle.
 */
export function ThemeToggle({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, isDark, unknown);

  return (
    <button
      type="button"
      id={themeToggleId}
      onClick={(event) => switchTheme(event.currentTarget)}
      aria-label="Dark mode"
      aria-pressed={dark ?? undefined}
      title="Dark mode"
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg"
    >
      {children}
    </button>
  );
}
