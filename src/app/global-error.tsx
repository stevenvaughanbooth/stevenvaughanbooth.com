'use client';

import { useSyncExternalStore } from 'react';
import { ErrorNotice } from '@/components/ui/error-notice';
import { type Theme, themeStorageKey } from '@/lib/tokens';
import './globals.css';

const subscribe = () => () => {};

function savedTheme(): Theme | undefined {
  try {
    const theme = localStorage.getItem(themeStorageKey);
    return theme === 'light' || theme === 'dark' ? theme : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Replaces the root layout when the layout itself fails (the Ask palette's lazy chunk lives
 * there), so it brings its own document, styles and the visitor's saved theme. Without a saved
 * choice the tokens follow the system theme.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const theme = useSyncExternalStore(subscribe, savedTheme, () => undefined);

  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-dvh">
        <title>Something went wrong</title>
        <main className="page flex min-h-dvh flex-col justify-center py-20">
          <p aria-hidden className="mb-12 font-mono text-lg font-medium">
            sb<span className="text-green">.</span>
          </p>
          <ErrorNotice title="The site didn’t load properly." error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
