import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/browser-mocks';
import { ASK_OPEN_EVENT, askBarFieldId } from '../ask/ask-events';
import { ThemeToggle } from '../theme-toggle';
import { shortcutsStorageKey } from './keys';
import { Shortcuts, ShortcutsButton } from './shortcuts';

// jsdom implements <dialog> without the modal API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  mockReducedMotion(false);
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  // Unmount while matchMedia is still stubbed: the toggle reads it as the theme resets.
  cleanup();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <>
      <input aria-label="Search" />
      <ThemeToggle>icon</ThemeToggle>
      <ShortcutsButton>Keyboard shortcuts</ShortcutsButton>
      <Shortcuts />
    </>,
  );
}

const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(target, { key, ...init });
  });
const sheet = () => screen.queryByRole('dialog', { name: 'Keyboard shortcuts' });

describe('Shortcuts', () => {
  it('opens the sheet on ?, loading it only then, and closes it on ? again', async () => {
    renderPage();
    expect(sheet()).not.toBeInTheDocument();

    press('?', document.body, { shiftKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toHaveFocus();

    press('?', dialog, { shiftKey: true });
    expect(sheet()).not.toBeInTheDocument();
    // Kept under <Activity>, hidden: the same element comes back on the next ?.
    expect(document.getElementById('shortcuts')).toBe(dialog);

    press('?', document.body, { shiftKey: true });
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBe(dialog);
  });

  it('opens again on a quick ?, before the last close has been reported', async () => {
    renderPage();
    press('?');
    const dialog = (await screen.findByRole('dialog')) as HTMLDialogElement;
    // As in browsers: the dialog closes at once, and its close event follows a task later.
    const close = vi.spyOn(dialog, 'close').mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      setTimeout(() => this.dispatchEvent(new Event('close')));
    });

    press('?', dialog);
    expect(dialog.open).toBe(false);
    press('?');
    await waitFor(() => expect(dialog.open).toBe(true));
    // The stale close event arrives, and the sheet stays open.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(sheet()).toBe(dialog);
    close.mockRestore();
  });

  it('lists every shortcut with its keys', async () => {
    renderPage();
    press('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const rows = [...dialog.querySelectorAll('dl > div')].map((row) => row.textContent);
    // jsdom is not an Apple platform, so the palette's shortcut reads Ctrl K.
    expect(rows).toEqual([
      'Ask StevenCtrl K',
      'Type a question/',
      'Switch themeT',
      'Show these shortcuts?',
      'Close a dialog or menuEsc',
    ]);
  });

  it('switches the theme on T', async () => {
    renderPage();
    press('t');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  describe('/', () => {
    const opened = vi.fn();
    beforeEach(() => {
      opened.mockReset();
      window.addEventListener(ASK_OPEN_EVENT, opened);
    });
    afterEach(() => window.removeEventListener(ASK_OPEN_EVENT, opened));

    function renderWithBar(top: number) {
      renderPage();
      const bar = document.createElement('input');
      bar.id = askBarFieldId;
      bar.setAttribute('aria-label', 'Ask about my work');
      document.body.append(bar);
      vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 600, 56));
      return bar;
    }

    it('focuses the hero ask bar while it is in view', () => {
      const bar = renderWithBar(300);
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      act(() => {
        document.body.dispatchEvent(event);
      });
      expect(bar).toHaveFocus();
      expect(event.defaultPrevented).toBe(true);
      expect(opened).not.toHaveBeenCalled();
      bar.remove();
    });

    it('opens Ask Steven once the bar has scrolled away, or on a page without one', () => {
      const bar = renderWithBar(-900);
      press('/');
      expect(bar).not.toHaveFocus();
      expect(opened).toHaveBeenCalledTimes(1);
      bar.remove();
      press('/');
      expect(opened).toHaveBeenCalledTimes(2);
    });

    it('stays out of the way of typing, modifiers, an open dialog and the switch', () => {
      const bar = renderWithBar(300);
      const typed = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      act(() => {
        screen.getByRole('textbox', { name: 'Search' }).dispatchEvent(typed);
      });
      expect(typed.defaultPrevented).toBe(false);
      press('/', document.body, { ctrlKey: true });

      // jsdom has no modal dialogs, so stand one in for the open palette.
      const modal = vi
        .spyOn(document, 'querySelector')
        .mockImplementation((selector) => (selector.includes(':modal') ? document.body : null));
      press('/');
      modal.mockRestore();

      localStorage.setItem(shortcutsStorageKey, 'off');
      press('/');
      expect(bar).not.toHaveFocus();
      expect(opened).not.toHaveBeenCalled();
      bar.remove();
    });
  });

  it('leaves keys alone while someone types', () => {
    renderPage();
    const field = screen.getByRole('textbox', { name: 'Search' });
    press('?', field);
    press('t', field);
    expect(sheet()).not.toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('turns single-key shortcuts off from the sheet, and the button still opens it', async () => {
    renderPage();
    press('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const toggle = screen.getByRole('switch', { name: 'Single-key shortcuts' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveAccessibleDescription(/Turn off \/, T and \?/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem(shortcutsStorageKey)).toBe('off');
    expect(screen.getByText('Switch theme')).toHaveTextContent('Switch theme (off)');

    // As Escape or the Close button would (jsdom has neither for dialogs).
    act(() => (dialog as HTMLDialogElement).close());
    expect(sheet()).not.toBeInTheDocument();
    press('?');
    press('t');
    expect(sheet()).not.toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Single-key shortcuts' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
