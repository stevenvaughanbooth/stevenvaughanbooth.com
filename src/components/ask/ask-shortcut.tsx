'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

function isApple(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad|ipod/i.test(platform || navigator.userAgent);
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. Renders "⌘K" on the server. */
export function useAskShortcutLabel(): string {
  return useSyncExternalStore(
    subscribe,
    () => (isApple() ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  );
}

export function AskShortcut() {
  return useAskShortcutLabel();
}
