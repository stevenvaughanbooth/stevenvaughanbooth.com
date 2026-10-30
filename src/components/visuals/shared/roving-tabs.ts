import type { KeyboardEvent } from 'react';

/**
 * The tab a key moves to in the ARIA tabs pattern: Left/Up and Right/Down step and wrap, Home
 * and End jump to the ends. Undefined for every other key.
 */
export function rovingIndex(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}

/**
 * Keydown handler for a tab inside a role="tablist": selects the target tab (automatic
 * activation) and moves focus to it. Every tablist on the site uses this.
 */
export function onRovingKeyDown(
  event: KeyboardEvent<HTMLElement>,
  index: number,
  count: number,
  select: (index: number) => void,
) {
  const target = rovingIndex(event.key, index, count);
  if (target === undefined) return;
  event.preventDefault();
  select(target);
  event.currentTarget
    .closest('[role="tablist"]')
    ?.querySelectorAll<HTMLElement>('[role="tab"]')
    [target]?.focus();
}
