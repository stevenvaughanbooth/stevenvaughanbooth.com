import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adage } from '@/content/profile';
import {
  mockIntersectionObserver,
  mockReducedMotion,
  setPageVisibility,
} from '@/test/browser-mocks';
import { ReflexDemo } from '../reflex-demo';
import { knownCommand, steps, transcript } from './script';
import { beatsShown, buildFrames, finalFrame, runProgress, type Step } from './timeline';

let page: ReturnType<typeof mockIntersectionObserver>;

const card = () => screen.getByRole('group', { name: 'Session replay, illustrative' });
const button = (name: string) => screen.getByRole('button', { name });
/** Text the terminal is holding back: hidden lines and untyped characters. */
const pendingText = () =>
  [...card().querySelectorAll('.invisible')].map((element) => element.textContent).join('');

/** Brings the card near the viewport and waits for the controller to replace the static render. */
async function loadController({ onScreen }: { onScreen: boolean }) {
  const staticButton = button('Replay the session');
  page.show(onScreen ? 0.6 : 0, { near: true });
  await waitFor(() => expect(staticButton).not.toBeInTheDocument());
  // The controller's first report: where the card is as it takes over.
  page.show(onScreen ? 0.6 : 0);
}

/** Runs the replay's timers, one beat at a time, until the replay offers to start again. */
function playToEnd() {
  for (let i = 0; i < 500 && !screen.queryByRole('button', { name: 'Replay the session' }); i++) {
    act(() => vi.runOnlyPendingTimers());
  }
}

beforeEach(() => {
  page = mockIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('reflex replay script', () => {
  it('quotes the README example from profile.ts verbatim', () => {
    const reflex = steps.find((step) => step.kind === 'reflex');
    expect(reflex).toMatchObject(adage.example);
    expect(adage.example.response).toContain(knownCommand);
  });

  it('fires the reflex only after a test command has failed repeatedly', () => {
    const before = steps.slice(
      0,
      steps.findIndex((step) => step.kind === 'reflex'),
    );
    const failures = before.filter((step) => step.kind === 'run' && step.result === 'fail');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(adage.example.condition).toMatch(/repeatedly/);
  });

  it('ends with the agent running the known command successfully', () => {
    expect(steps.at(-1)).toMatchObject({ kind: 'run', command: knownCommand, result: 'pass' });
  });

  it('tells the whole story in the transcript', () => {
    const text = transcript(steps).join(' ');
    [adage.example.condition, adage.example.response, adage.example.evidence].forEach((part) =>
      expect(text).toContain(part),
    );
    expect(text).not.toMatch(/\bE {2,}/);
  });
});

describe('replay timeline', () => {
  const run: Step = { kind: 'run', command: 'ls', output: ['a', 'b'], result: 'pass' };

  it('starts empty and finishes with every step complete', () => {
    const frames = buildFrames(steps);
    expect(frames[0]).toMatchObject({ step: 0, beat: 0 });
    expect(frames.at(-1)).toMatchObject({ step: finalFrame(steps).step, beat: 0 });
    expect(finalFrame(steps).step).toBe(steps.length);
    frames.slice(1).forEach((frame) => expect(frame.delay).toBeGreaterThan(0));
  });

  it('types a command, then prints output, then shows the status', () => {
    expect(runProgress(run, 0)).toMatchObject({ prompt: false, typed: 0, outputs: 0 });
    expect(runProgress(run, 2)).toMatchObject({ prompt: true, typed: 1, typing: true });
    expect(runProgress(run, 4)).toMatchObject({
      typed: 2,
      outputs: 1,
      typing: false,
      status: false,
    });
    expect(runProgress(run, Infinity)).toMatchObject({ typed: 2, outputs: 2, status: true });
  });

  it('reports earlier steps as complete and later steps as hidden', () => {
    const frame = { step: 1, beat: 2, delay: 0 };
    expect(beatsShown(frame, 0)).toBe(Infinity);
    expect(beatsShown(frame, 1)).toBe(2);
    expect(beatsShown(frame, 2)).toBe(0);
  });
});

describe('<ReflexDemo />', () => {
  it('server-renders the finished session, its transcript and the pipeline', () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);

    const [story, pipeline] = within(card()).getAllByRole('list');
    expect(
      within(story!)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(transcript(steps));
    expect(pipeline).toHaveAccessibleName('From history to reuse');
    within(pipeline!)
      .getAllByRole('listitem')
      .forEach((li, i) => expect(li).toHaveTextContent(adage.pipeline[i]!));
    // The terminal is hidden from AT, and nothing in it is waiting to be revealed.
    expect(card().querySelector('[aria-hidden="true"].font-mono')).toHaveTextContent(
      'reflex matched',
    );
    expect(pendingText()).toBe('');
    expect(card().querySelector('[data-matched][data-looping]')).not.toBeNull();
  });

  it('rests on the finished session under reduced motion', async () => {
    mockReducedMotion(true);
    render(<ReflexDemo />);
    await loadController({ onScreen: false });
    vi.useFakeTimers();
    page.show(1);

    expect(pendingText()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets out of sight, then plays once as it scrolls in and offers a replay', async () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);
    await loadController({ onScreen: false });
    vi.useFakeTimers();

    expect(pendingText()).not.toBe('');
    expect(button('Play the session')).toBeInTheDocument();
    page.show(0.2);
    expect(button('Play the session')).toBeInTheDocument(); // not far enough on screen yet

    page.show(0.6);
    expect(button('Skip to the end of the session')).toBeInTheDocument();
    expect(screen.getByText('Replaying')).toBeInTheDocument();
    playToEnd();
    expect(button('Replay the session')).toBeInTheDocument();
    expect(pendingText()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the finished session when it is already on screen as the controller loads', async () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);
    await loadController({ onScreen: true });
    vi.useFakeTimers();
    page.show(1);

    expect(pendingText()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(button('Replay the session'));
    expect(pendingText()).not.toBe('');
    expect(button('Skip to the end of the session')).toBeInTheDocument();
  });

  it('skips to the end on request', async () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);
    await loadController({ onScreen: false });
    vi.useFakeTimers();
    page.show(1);

    act(() => vi.runOnlyPendingTimers());
    const control = button('Skip to the end of the session');
    act(() => control.focus());
    fireEvent.click(control);
    expect(pendingText()).toBe('');
    // The same button changes its label, so focus stays on it.
    expect(button('Replay the session')).toBe(control);
    expect(control).toHaveFocus();
    act(() => vi.advanceTimersByTime(60_000));
    expect(button('Replay the session')).toBe(control);
  });

  it('holds while off screen or in a background tab', async () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);
    await loadController({ onScreen: false });
    vi.useFakeTimers();
    page.show(1);
    act(() => vi.runOnlyPendingTimers());
    const shown = pendingText();

    page.show(0);
    act(() => vi.advanceTimersByTime(60_000));
    expect(pendingText()).toBe(shown);

    page.show(1);
    setPageVisibility('hidden');
    act(() => vi.advanceTimersByTime(60_000));
    expect(pendingText()).toBe(shown);
    expect(button('Skip to the end of the session')).toBeInTheDocument();
  });
});
