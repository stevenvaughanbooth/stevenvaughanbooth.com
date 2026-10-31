/**
 * The site's single-key shortcuts: / starts a question, ? opens the shortcuts sheet and T switches
 * the theme. (⌘K / Ctrl+K, which opens Ask Steven, is the palette loader's.) A key counts only when
 * nobody is typing and no modifier is held, and visitors can turn single-key shortcuts off from the
 * sheet, as WCAG 2.1.4 requires: they can clash with speech input and other assistive technology.
 */

export type ShortcutAction = 'ask' | 'sheet' | 'theme';

/** The sheet's dialog id, so the listener can find it without loading its code. */
export const sheetId = 'shortcuts';

/** localStorage key; "off" turns single-key shortcuts off. */
export const shortcutsStorageKey = 'shortcuts';

// The choice for this page, for when storage is unavailable (private mode).
let enabledHere = true;

/** Whether single-key shortcuts are on: the default, unless the visitor turned them off. */
export function characterKeysEnabled(): boolean {
  try {
    return localStorage.getItem(shortcutsStorageKey) !== 'off';
  } catch {
    return enabledHere;
  }
}

export function setCharacterKeysEnabled(enabled: boolean): void {
  enabledHere = enabled;
  try {
    if (enabled) localStorage.removeItem(shortcutsStorageKey);
    else localStorage.setItem(shortcutsStorageKey, 'off');
  } catch {
    // Without storage the choice lasts until the page closes.
  }
}

// Inputs that take a character as text, rather than as a press (checkboxes, buttons, ranges...).
const notText = [
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]
  .map((type) => `[type=${type}]`)
  .join(', ');

const typing = [
  `input:not(${notText})`,
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
].join(', ');

/** Whether a key pressed in `target` is text being typed: fields, editable content, comboboxes. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(typing) !== null;
}

/**
 * The shortcut a keydown asks for, or null. Held keys, IME composition, modifiers (AltGr aside,
 * which some layouts need for ?) and keys typed into a field never count.
 */
export function shortcutFor(event: KeyboardEvent): ShortcutAction | null {
  if (event.defaultPrevented || event.repeat || event.isComposing) return null;
  const altGraph = event.getModifierState('AltGraph');
  if (event.metaKey || ((event.ctrlKey || event.altKey) && !altGraph)) return null;
  if (isTypingTarget(event.target)) return null;
  if (event.key === '/') return 'ask';
  if (event.key === '?') return 'sheet';
  // Caps Lock gives "T" without Shift; Shift+T is left alone.
  if ((event.key === 't' || event.key === 'T') && !event.shiftKey) return 'theme';
  return null;
}
