/**
 * The site's single-key shortcuts: / starts a question, ? opens the shortcuts sheet, T switches
 * the theme and X peels the page back to show what it is made of. (⌘K / Ctrl+K, which opens Ask
 * Steven, is the palette loader's.) A key counts only when
 * nobody is typing and no modifier is held, and visitors can turn single-key shortcuts off from the
 * sheet, as WCAG 2.1.4 requires: they can clash with speech input and other assistive technology.
 */

export type ShortcutAction = 'ask' | 'sheet' | 'theme' | 'xray';

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
  announceKeys(enabled);
}

/**
 * Keeps aria-keyshortcuts true: a control marked data-keyshortcut="X" announces its single key
 * only while single keys are on.
 */
export function announceKeys(enabled = characterKeysEnabled()): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-keyshortcut]')) {
    if (enabled) element.setAttribute('aria-keyshortcuts', element.dataset.keyshortcut ?? '');
    else element.removeAttribute('aria-keyshortcuts');
  }
}

/** sessionStorage key: "on" while X-ray is on, so a full page load in the same tab keeps it. */
export const xrayStorageKey = 'xray';

/** The performance mark X-ray's HUD splits the page's downloads at: when X-ray was asked for. */
export const xrayMark = 'xray-requested';

/**
 * Whether X-ray starts on as the page loads: ?xray (or ?xray=1) turns it on and ?xray=0 keeps it
 * off; without either it is as this tab last left it.
 */
export function xrayWanted(search: string, stored: string | null): boolean {
  const asked = new URLSearchParams(search).get('xray');
  if (asked !== null) return !['0', 'false', 'off'].includes(asked.toLowerCase());
  return stored === 'on';
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
  // Caps Lock gives "T" without Shift; Shift+T is left alone. The same goes for X.
  if (event.shiftKey) return null;
  if (event.key === 't' || event.key === 'T') return 'theme';
  if (event.key === 'x' || event.key === 'X') return 'xray';
  return null;
}
