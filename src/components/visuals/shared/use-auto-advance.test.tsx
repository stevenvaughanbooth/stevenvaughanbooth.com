import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockIntersectionObserver,
  mockReducedMotion,
  setPageVisibility,
} from '@/test/browser-mocks';
import { useAutoAdvance } from './use-auto-advance';

const durationMs = 1000;

function Tour() {
  const tour = useAutoAdvance({ steps: 4, durationMs });
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

beforeEach(() => {
  page = mockIntersectionObserver();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAutoAdvance', () => {
  it('rests on the last step and never starts under reduced motion', () => {
    mockReducedMotion(true);
    render(<Tour />);
    page.show(1);
    tick(durationMs * 5);
    expect(selected()).toBe('Step 3');
    expect(playback()).toBe('idle');
  });

  it('starts from the first step as it scrolls in, and counts down only when half on screen', () => {
    mockReducedMotion(false);
    render(<Tour />);
    expect(selected()).toBe('Step 3');

    page.show(0.2);
    expect(selected()).toBe('Step 0');
    tick(durationMs * 2);
    expect(selected()).toBe('Step 0');

    page.show(0.6);
    tick(durationMs);
    expect(selected()).toBe('Step 1');

    page.show(0);
    tick(durationMs * 2);
    expect(selected()).toBe('Step 1');
  });

  it('plays once, then rests on the last step until replayed', () => {
    mockReducedMotion(false);
    render(<Tour />);
    page.show(1);
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
    page.show(1);
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
    page.show(1);

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
    page.show(1);

    setPageVisibility('hidden');
    tick(durationMs * 3);
    expect(selected()).toBe('Step 0');

    setPageVisibility('visible');
    tick(durationMs);
    expect(selected()).toBe('Step 1');
  });

  it('stops for good once a tab takes focus or the visitor picks a step', () => {
    mockReducedMotion(false);
    render(<Tour />);
    page.show(1);

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

  it('never moves the selection when focus is already inside as it scrolls in', () => {
    mockReducedMotion(false);
    render(<Tour />);

    act(() => screen.getByRole('tab', { name: 'Step 3' }).focus());
    page.show(1);
    tick(durationMs * 3);
    expect(selected()).toBe('Step 3');
    expect(screen.getByRole('tab', { name: 'Step 3' })).toHaveFocus();
  });

  it('pauses and resumes from the play control', () => {
    mockReducedMotion(false);
    render(<Tour />);
    page.show(1);
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
});
