import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/browser-mocks';
import { ThemeToggle } from './theme-toggle';

const root = document.documentElement;

/** A View Transitions API that runs the update at once and finishes when told to. */
function mockViewTransitions({ types = true } = {}) {
  let finish = () => {};
  const start = vi.fn((options: StartViewTransitionOptions) => {
    if (typeof options.update === 'function') void options.update();
    return { finished: new Promise<void>((resolve) => (finish = resolve)) };
  });
  vi.stubGlobal('CSS', { supports: () => types });
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  return { start, finish: () => act(async () => finish()) };
}

function renderToggle() {
  render(<ThemeToggle>icon</ThemeToggle>);
  const button = screen.getByRole('button', { name: 'Dark mode' });
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(1200, 14, 36, 36));
  return button;
}

beforeEach(() => {
  root.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  delete root.dataset.theme;
  root.removeAttribute('style');
  Reflect.deleteProperty(document, 'startViewTransition');
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeToggle', () => {
  it('switches theme, reports it with aria-pressed and remembers it', async () => {
    mockReducedMotion(false);
    const button = renderToggle();
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(root.dataset.theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
  });

  it('reveals the new theme from the toggle in a theme-typed view transition', async () => {
    mockReducedMotion(false);
    const transitions = mockViewTransitions();
    const button = renderToggle();

    fireEvent.click(button);
    expect(transitions.start).toHaveBeenCalledWith({
      update: expect.any(Function),
      types: ['theme'],
    });
    expect(root.dataset.theme).toBe('dark');
    // The circle grows from the middle of the button.
    expect(root.style.getPropertyValue('--reveal-x')).toBe('1218px');
    expect(root.style.getPropertyValue('--reveal-y')).toBe('32px');

    await transitions.finish();
    expect(root.style.getPropertyValue('--reveal-x')).toBe('');
    expect(root.style.getPropertyValue('--reveal-y')).toBe('');
  });

  it('switches at once under reduced motion', () => {
    mockReducedMotion(true);
    const transitions = mockViewTransitions();
    fireEvent.click(renderToggle());
    expect(transitions.start).not.toHaveBeenCalled();
    expect(root.dataset.theme).toBe('dark');
  });

  it('switches at once where view transitions cannot be typed', () => {
    mockReducedMotion(false);
    const transitions = mockViewTransitions({ types: false });
    fireEvent.click(renderToggle());
    expect(transitions.start).not.toHaveBeenCalled();
    expect(root.dataset.theme).toBe('dark');
  });
});
