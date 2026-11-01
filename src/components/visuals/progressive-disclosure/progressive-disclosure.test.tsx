import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockIntersectionObserver, mockReducedMotion } from '@/test/browser-mocks';
import { ProgressiveDisclosure } from '../progressive-disclosure';
import { TOUR_DWELL_MS } from '../shared/tour/wording';

// The controller's first dynamic import is transformed on demand, which can take over a second
// when the whole suite runs in parallel.
const controllerLoad = { timeout: 5000 };

let page: ReturnType<typeof mockIntersectionObserver>;
const selectedTab = () => screen.getByRole('tab', { selected: true });
// Timers advance in slices so each step's effect can schedule the next timer.
const tick = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) act(() => vi.advanceTimersByTime(100));
};

async function loadController() {
  const staticTabs = screen.getByRole('tablist');
  page.show(0, { near: true });
  await waitFor(() => expect(staticTabs).not.toBeInTheDocument(), controllerLoad);
  // The controller's first report: still out of sight, so the tour resets to its first step.
  page.show(0);
}

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ProgressiveDisclosure', () => {
  it('server-renders the opened record, its tool call and one diagram, ready to play', () => {
    mockReducedMotion(false);
    render(<ProgressiveDisclosure />);
    expect(
      screen.getByRole('group', { name: 'Context on demand, illustrative' }),
    ).toBeInTheDocument();
    expect(selectedTab()).toHaveAccessibleName('Query');
    const diagram = screen.getByRole('img', { name: /^Query:/ });
    expect(diagram.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.getByText('query')).toBeVisible();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play auto-advance' })).toBeInTheDocument();
  });

  it('tours describe, search and query once as it scrolls in, then offers a replay', async () => {
    mockReducedMotion(false);
    render(<ProgressiveDisclosure />);
    await loadController();
    vi.useFakeTimers();

    page.show(1);
    expect(selectedTab()).toHaveAccessibleName('Describe');
    expect(screen.getByText('Auto-advancing')).toBeInTheDocument();
    tick(TOUR_DWELL_MS);
    expect(selectedTab()).toHaveAccessibleName('Search');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Search');

    tick(TOUR_DWELL_MS);
    expect(screen.getByRole('img', { name: /^Query:/ })).toBeInTheDocument();
    const call = screen.getByText('query').closest('dl');
    expect(call).not.toBeNull();
    expect(
      within(call as HTMLElement)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Definition', '·Fields', '·Relationships']);
    tick(TOUR_DWELL_MS * 2);
    expect(selectedTab()).toHaveAccessibleName('Query');
    expect(screen.getByRole('button', { name: 'Replay auto-advance' })).toBeInTheDocument();
    // Autoplay is silent: the card has no live region to announce it.
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('pauses from its control and stops for good when a step is picked', async () => {
    mockReducedMotion(false);
    render(<ProgressiveDisclosure />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-advance' }));
    tick(TOUR_DWELL_MS * 2);
    expect(selectedTab()).toHaveAccessibleName('Describe');
    expect(screen.getByText('Paused')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play auto-advance' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Query' }));
    tick(TOUR_DWELL_MS * 2);
    expect(selectedTab()).toHaveAccessibleName('Query');
    expect(screen.getByRole('button', { name: 'Play auto-advance' })).toBeInTheDocument();
  });

  it('supports the tabs keyboard pattern, and rests under reduced motion', async () => {
    mockReducedMotion(true);
    render(<ProgressiveDisclosure />);
    await loadController();
    vi.useFakeTimers();
    page.show(1);
    tick(TOUR_DWELL_MS * 2);
    expect(selectedTab()).toHaveAccessibleName('Query');

    fireEvent.keyDown(selectedTab(), { key: 'ArrowRight' });
    expect(selectedTab()).toHaveAccessibleName('Describe');
    expect(selectedTab()).toHaveFocus();
    fireEvent.keyDown(selectedTab(), { key: 'ArrowDown' });
    expect(selectedTab()).toHaveAccessibleName('Search');
    fireEvent.keyDown(selectedTab(), { key: 'End' });
    expect(selectedTab()).toHaveAccessibleName('Query');
  });

  it('keeps the 2D graph where WebGL is unavailable, loading no 3D scene', async () => {
    mockReducedMotion(false);
    render(<ProgressiveDisclosure />);
    await loadController();
    // jsdom has no WebGL: the scene's box stays empty and the stage keeps its SVG.
    const stage = screen.getByRole('img');
    // The scene's box comes first in the stage, before the graph it covers.
    const scene = stage.firstElementChild;
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stage.querySelector('canvas')).toBeNull();
    expect(stage.querySelector('[data-scene="live"]')).toBeNull();
    expect(scene).toBeEmptyDOMElement();
    expect(stage.querySelectorAll('svg')).toHaveLength(1);
  });
});
