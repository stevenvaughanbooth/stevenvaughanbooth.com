import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockIntersectionObserver, mockReducedMotion } from '@/test/browser-mocks';
import { TeamMultiplier } from '../team-multiplier';

const dwellMs = 5000;

let page: ReturnType<typeof mockIntersectionObserver>;
const selectedTab = () => screen.getByRole('tab', { selected: true });
// Timers advance in slices so each step's effect can schedule the next timer.
const tick = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) act(() => vi.advanceTimersByTime(100));
};

/** Brings the card near the viewport and waits for the controller to replace the static render. */
async function loadController() {
  const staticTabs = screen.getByRole('tablist');
  page.show(0, { near: true });
  await waitFor(() => expect(staticTabs).not.toBeInTheDocument());
}

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TeamMultiplier', () => {
  it('server-renders the complete loop with one diagram and a text alternative', () => {
    mockReducedMotion(false);
    render(<TeamMultiplier />);

    const card = screen.getByRole('group', { name: 'Multiplier effect, illustrative' });
    expect(selectedTab()).toHaveAccessibleName('Learn');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Learn');
    const diagram = within(card).getByRole('img', { name: /^Learn:/ });
    expect(diagram.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.getByText('Let shared experience improve the practice.')).toBeVisible();
  });

  it('rests on the complete loop under reduced motion and never auto-advances', async () => {
    mockReducedMotion(true);
    render(<TeamMultiplier />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);
    tick(dwellMs * 3);

    expect(selectedTab()).toHaveAccessibleName('Learn');
    expect(screen.getByRole('img', { name: /^Learn:/ })).toBeInTheDocument();
  });

  it('selects stages by click and by keyboard, with focus following selection', async () => {
    mockReducedMotion(true);
    render(<TeamMultiplier />);
    await loadController();

    fireEvent.click(screen.getByRole('tab', { name: 'Share' }));
    expect(selectedTab()).toHaveAccessibleName('Share');
    expect(screen.getByRole('img', { name: /^Share:/ })).toBeInTheDocument();
    expect(screen.getByText('Make useful practice visible.')).toBeVisible();

    fireEvent.keyDown(selectedTab(), { key: 'ArrowRight' });
    expect(selectedTab()).toHaveAccessibleName('Enable');
    expect(selectedTab()).toHaveFocus();
    expect(selectedTab()).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Share' })).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(selectedTab(), { key: 'Home' });
    expect(selectedTab()).toHaveAccessibleName('Discover');
    fireEvent.keyDown(selectedTab(), { key: 'ArrowUp' });
    expect(selectedTab()).toHaveAccessibleName('Learn');
  });

  it('plays one pass from Discover as it scrolls in, holding off screen and on pause', async () => {
    mockReducedMotion(false);
    render(<TeamMultiplier />);
    await loadController();
    vi.useFakeTimers();

    page.show(0.2);
    expect(selectedTab()).toHaveAccessibleName('Discover');
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Discover'); // not far enough on screen yet

    page.show(0.8);
    expect(screen.getByText('Auto-advancing')).toBeInTheDocument();
    tick(dwellMs);
    expect(selectedTab()).toHaveAccessibleName('Share');

    page.show(0);
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Share');

    page.show(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-advance' }));
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Share');

    fireEvent.click(screen.getByRole('button', { name: 'Play auto-advance' }));
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Learn');
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Learn');
    expect(screen.getByRole('button', { name: 'Replay auto-advance' })).toBeInTheDocument();
  });

  it('holds while keyboard focus is in the panel', async () => {
    mockReducedMotion(false);
    render(<TeamMultiplier />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);

    act(() => screen.getByRole('tabpanel').focus());
    tick(dwellMs * 2);
    expect(selectedTab()).toHaveAccessibleName('Discover');
    expect(screen.getByText('Paused while you look')).toBeInTheDocument();

    act(() => screen.getByRole('tabpanel').blur());
    tick(dwellMs);
    expect(selectedTab()).toHaveAccessibleName('Share');
  });

  it('never resets the stage under a tab that already has focus', async () => {
    mockReducedMotion(false);
    render(<TeamMultiplier />);

    // Tabbing in focuses the static Learn tab, which loads the controller at once.
    act(() => screen.getByRole('tab', { name: 'Learn' }).focus());
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Learn' })).toHaveFocus());
    vi.useFakeTimers();
    page.show(1);
    tick(dwellMs * 3);

    expect(selectedTab()).toHaveAccessibleName('Learn');
    expect(selectedTab()).toHaveFocus();
    expect(selectedTab()).toHaveAttribute('tabindex', '0');
  });

  it('stops auto-advancing once the visitor picks a stage', async () => {
    mockReducedMotion(false);
    render(<TeamMultiplier />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Enable' }));
    fireEvent.blur(screen.getByRole('tab', { name: 'Enable' }));
    tick(dwellMs * 3);
    expect(selectedTab()).toHaveAccessibleName('Enable');
    expect(screen.getByRole('button', { name: 'Play auto-advance' })).toBeInTheDocument();
  });
});
