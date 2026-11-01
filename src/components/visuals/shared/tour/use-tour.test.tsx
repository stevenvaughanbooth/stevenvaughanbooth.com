import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockIntersectionObserver,
  mockReducedMotion,
  setPageVisibility,
} from '@/test/browser-mocks';
import { TOUR_HOLD_MAX_MS, TOUR_OVERVIEW_MS, type TourOptions, useTour } from './use-tour';

const durationMs = 1000;

function Tour(options: Partial<TourOptions>) {
  const tour = useTour({ steps: 4, dwellMs: durationMs, ...options });
  return (
    <>
      <div {...tour.region} data-testid="region">
        <div role="tablist">
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={tour.step === index}
              onClick={() => tour.select(index)}
            >
              {`Step ${index}`}
            </button>
          ))}
        </div>
        <div role="tabpanel" tabIndex={0} />
      </div>
      <p data-testid="playback">{tour.playback}</p>
      <p data-testid="looking">{String(tour.looking)}</p>
      <p data-testid="progress">
        {tour.progress ? `${tour.progress.key} ${tour.progress.durationMs}` : ''}
      </p>
      <button type="button" onClick={tour.toggle}>
        Toggle
      </button>
    </>
  );
}

let page: ReturnType<typeof mockIntersectionObserver>;
const selected = () => screen.getByRole('tab', { selected: true }).textContent;
const playback = () => screen.getByTestId('playback').textContent;
// Timers advance in slices so each step's effect can schedule the next timer.
const tick = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) act(() => vi.advanceTimersByTime(100));
};
/** Loads out of sight, as on the home page, then scrolls fully into view: it starts at once. */
const arrive = () => {
  page.show(0);
  page.show(1);
  act(() => vi.advanceTimersByTime(0));
};

beforeEach(() => {
  page = mockIntersectionObserver();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTour', () => {
  it('rests on the last step and never starts under reduced motion', () => {
    mockReducedMotion(true);
    render(<Tour />);
    arrive();
    tick(durationMs * 5);
    expect(selected()).toBe('Step 3');
    expect(playback()).toBe('idle');
  });

  it('resets out of sight, then starts and counts down only when half on screen', () => {
    mockReducedMotion(false);
    render(<Tour />);
    expect(selected()).toBe('Step 3');

    page.show(0);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('ready');

    page.show(0.2);
    tick(durationMs * 2);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('ready');

    page.show(0.6);
    tick(durationMs + 100);
    expect(selected()).toBe('Step 1');

    page.show(0);
    tick(durationMs * 2);
    expect(selected()).toBe('Step 1');
  });

  it('plays once, then rests on the last step until replayed', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();
    tick(durationMs * 3);
    expect(selected()).toBe('Step 3');
    expect(playback()).toBe('done');
    tick(durationMs * 3);
    expect(selected()).toBe('Step 3');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('playing');
  });

  it('holds while a mouse hovers, keeping the time already spent on the step', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();
    tick(durationMs * 0.6);

    fireEvent.pointerEnter(screen.getByTestId('region'), { pointerType: 'mouse' });
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');

    fireEvent.pointerLeave(screen.getByTestId('region'), { pointerType: 'mouse' });
    tick(durationMs * 0.5);
    expect(selected()).toBe('Step 1');
  });

  it('holds while focus is in the panel and resumes when it leaves', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();

    act(() => screen.getByRole('tabpanel').focus());
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('playing');

    act(() => screen.getByRole('tabpanel').blur());
    tick(durationMs);
    expect(selected()).toBe('Step 1');
  });

  it('holds while the browser tab is hidden', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();

    setPageVisibility('hidden');
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');

    setPageVisibility('visible');
    tick(durationMs);
    expect(selected()).toBe('Step 1');
  });

  it('holds while a modal dialog covers the page', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();

    // jsdom never matches :modal, so report one open, as the Ask palette or shortcuts would.
    const dialog = document.body.appendChild(document.createElement('dialog'));
    const querySelector = document.querySelector.bind(document);
    const modal = vi
      .spyOn(document, 'querySelector')
      .mockImplementation(((selector: string) =>
        selector === 'dialog:modal' ? dialog : querySelector(selector)) as never);
    act(() => {
      dialog.dispatchEvent(new Event('toggle'));
    });
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('playing');

    modal.mockRestore();
    act(() => {
      dialog.dispatchEvent(new Event('toggle'));
    });
    tick(durationMs);
    expect(selected()).toBe('Step 1');
    dialog.remove();
  });

  it('stops for good once a tab takes focus or the visitor picks a step', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();

    act(() => screen.getByRole('tab', { name: 'Step 0' }).focus());
    act(() => screen.getByRole('tab', { name: 'Step 0' }).blur());
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('paused');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Step 2' }));
    tick(durationMs * 3);
    expect(selected()).toBe('Step 2');
    expect(playback()).toBe('paused');
  });

  it('never moves the selection when focus is already inside as it loads', () => {
    mockReducedMotion(false);
    render(<Tour />);

    act(() => screen.getByRole('tab', { name: 'Step 3' }).focus());
    page.show(0);
    page.show(1);
    tick(durationMs * 3);
    expect(selected()).toBe('Step 3');
    expect(screen.getByRole('tab', { name: 'Step 3' })).toHaveFocus();
  });

  it('pauses and resumes from the play control', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();
    tick(durationMs);
    expect(selected()).toBe('Step 1');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    tick(durationMs * 3);
    expect(selected()).toBe('Step 1');
    expect(playback()).toBe('paused');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    tick(durationMs);
    expect(selected()).toBe('Step 2');
  });

  it('holds while a pointer is pressed in the region, until it is let go anywhere', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();

    fireEvent.pointerDown(screen.getByRole('tabpanel'), { pointerType: 'touch' });
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('playing');

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    tick(durationMs);
    expect(selected()).toBe('Step 1');
  });

  it('gives each step its own dwell when asked', () => {
    mockReducedMotion(false);
    render(<Tour dwellMs={(step) => (step + 1) * 500} />);
    arrive();
    expect(screen.getByTestId('progress').textContent).toMatch(/ 500$/);
    tick(500);
    expect(selected()).toBe('Step 1');
    tick(900);
    expect(selected()).toBe('Step 1');
    tick(100);
    expect(selected()).toBe('Step 2');
  });

  it('restarts the step’s progress when played again', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();
    const first = screen.getByTestId('progress').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('progress').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByTestId('progress').textContent).not.toBe(first);
    expect(selected()).toBe('Step 0');
  });

  it('opens on the whole picture when it loads on screen, and starts from the top once settled', () => {
    mockReducedMotion(false);
    render(<Tour threshold={0.4} />);
    page.show(1);
    expect(selected()).toBe('Step 3');
    expect(playback()).toBe('ready');

    // A mouse resting on it keeps the picture as it is.
    fireEvent.pointerEnter(screen.getByTestId('region'), { pointerType: 'mouse' });
    tick(TOUR_OVERVIEW_MS * 3);
    expect(selected()).toBe('Step 3');
    fireEvent.pointerLeave(screen.getByTestId('region'), { pointerType: 'mouse' });

    tick(TOUR_OVERVIEW_MS - 200);
    expect(selected()).toBe('Step 3');
    tick(300);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('playing');
    tick(durationMs);
    expect(selected()).toBe('Step 1');
  });

  it('waits on its scene, but not for longer than the hold allows', () => {
    mockReducedMotion(false);
    const { rerender } = render(<Tour hold />);
    arrive();
    tick(durationMs * 2);
    expect(selected()).toBe('Step 0');
    expect(playback()).toBe('ready');

    rerender(<Tour hold={false} />);
    tick(durationMs + 100);
    expect(selected()).toBe('Step 1');
  });

  it('plays without its scene once the hold has lapsed', () => {
    mockReducedMotion(false);
    render(<Tour hold />);
    arrive();
    tick(TOUR_HOLD_MAX_MS - 200);
    expect(selected()).toBe('Step 0');
    tick(200 + durationMs + 200);
    expect(selected()).toBe('Step 1');
  });

  it('says it is held by the visitor only while they look', () => {
    mockReducedMotion(false);
    render(<Tour />);
    arrive();
    expect(screen.getByTestId('looking').textContent).toBe('false');
    page.show(0);
    expect(screen.getByTestId('looking').textContent).toBe('false');
    fireEvent.pointerEnter(screen.getByTestId('region'), { pointerType: 'mouse' });
    expect(screen.getByTestId('looking').textContent).toBe('true');
  });
});
