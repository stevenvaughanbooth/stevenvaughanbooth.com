import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  characterKeysEnabled,
  isTypingTarget,
  setCharacterKeysEnabled,
  shortcutFor,
  shortcutsStorageKey,
} from './keys';

/** The shortcut a key pressed with focus on `target` asks for. */
function press(init: KeyboardEventInit, target: Element = document.body) {
  let action: ReturnType<typeof shortcutFor> = null;
  const listener = (event: KeyboardEvent) => {
    action = shortcutFor(event);
  };
  window.addEventListener('keydown', listener);
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  window.removeEventListener('keydown', listener);
  return action;
}

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('shortcutFor', () => {
  it('maps / to a question, ? to the sheet, T to the theme and X to X-ray', () => {
    expect(press({ key: '/' })).toBe('ask');
    expect(press({ key: '?', shiftKey: true })).toBe('sheet');
    expect(press({ key: 't' })).toBe('theme');
    expect(press({ key: 'x' })).toBe('xray');
    // Caps Lock gives a capital without Shift.
    expect(press({ key: 'T' })).toBe('theme');
    expect(press({ key: 'X' })).toBe('xray');
    expect(press({ key: 'q' })).toBeNull();
  });

  it('ignores modifiers, Shift+T, Shift+X, held keys and composition', () => {
    expect(press({ key: '?', metaKey: true })).toBeNull();
    expect(press({ key: '?', ctrlKey: true })).toBeNull();
    expect(press({ key: 't', altKey: true })).toBeNull();
    expect(press({ key: 'T', shiftKey: true })).toBeNull();
    expect(press({ key: 'X', shiftKey: true })).toBeNull();
    expect(press({ key: 'x', metaKey: true })).toBeNull();
    expect(press({ key: '?', repeat: true })).toBeNull();
    expect(press({ key: '?', isComposing: true })).toBeNull();
  });

  it('allows AltGr, which some layouts need for ?', () => {
    expect(press({ key: '?', ctrlKey: true, altKey: true, modifierAltGraph: true })).toBe('sheet');
  });

  it('leaves keys to fields and to anyone who handled them first', () => {
    document.body.innerHTML = '<input /><textarea></textarea><div contenteditable="true"></div>';
    for (const field of document.body.children) expect(press({ key: '?' }, field)).toBeNull();

    const handled = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener('keydown', handled, { capture: true });
    expect(press({ key: '?' })).toBeNull();
    document.removeEventListener('keydown', handled, { capture: true });
  });
});

describe('isTypingTarget', () => {
  it('counts text fields and editable content, not buttons or checkboxes', () => {
    document.body.innerHTML = `
      <input id="text" type="search" />
      <input id="check" type="checkbox" />
      <select id="select"></select>
      <div role="combobox" id="combo"></div>
      <div contenteditable="true"><span id="inside"></span></div>
      <div contenteditable="false" id="readonly"></div>
      <button id="button"></button>`;
    const typing = (id: string) => isTypingTarget(document.getElementById(id));
    expect(typing('text')).toBe(true);
    expect(typing('select')).toBe(true);
    expect(typing('combo')).toBe(true);
    expect(typing('inside')).toBe(true);
    expect(typing('check')).toBe(false);
    expect(typing('readonly')).toBe(false);
    expect(typing('button')).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('the single-key preference', () => {
  it('is on by default and remembers being turned off', () => {
    expect(characterKeysEnabled()).toBe(true);
    setCharacterKeysEnabled(false);
    expect(localStorage.getItem(shortcutsStorageKey)).toBe('off');
    expect(characterKeysEnabled()).toBe(false);
    setCharacterKeysEnabled(true);
    expect(localStorage.getItem(shortcutsStorageKey)).toBeNull();
    expect(characterKeysEnabled()).toBe(true);
  });

  it('still applies for the page when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    setCharacterKeysEnabled(false);
    expect(characterKeysEnabled()).toBe(false);
    setCharacterKeysEnabled(true);
    expect(characterKeysEnabled()).toBe(true);
  });
});
