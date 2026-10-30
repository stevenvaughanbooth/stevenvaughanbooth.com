'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import { type Theme, themeStorageKey } from '@/lib/tokens';

const darkQuery = '(prefers-color-scheme: dark)';

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

/**
 * Flips light/dark, remembers the choice, and animates with a View Transition when available.
 * The icons arrive as server-rendered children, so the icon set stays out of the client bundle.
 */
export function ThemeToggle({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, isDark, unknown);

  function toggle() {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(themeStorageKey, next);
      } catch {
        // Storage can be unavailable (private mode); the choice still applies to this page.
      }
    };
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && 'startViewTransition' in document) document.startViewTransition(apply);
    else apply();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Dark mode"
      aria-pressed={dark ?? undefined}
      title="Dark mode"
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg"
    >
      {children}
    </button>
  );
}
