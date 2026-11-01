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
import { reflexSceneData } from './scene-data';
import { sceneBeat, sceneBeats } from './scene-beats';
import { beatCount, beatsShown, buildFrames, finalFrame, runProgress, type Step } from './timeline';

// The controller's first dynamic import is transformed on demand, which can take over a second
// when the whole suite runs in parallel.
const controllerLoad = { timeout: 5000 };

let page: ReturnType<typeof mockIntersectionObserver>;

const card = () => screen.getByRole('group', { name: 'Session replay, illustrative' });
const button = (name: string) => screen.getByRole('button', { name });
/** Text the terminal is holding back: hidden lines and untyped characters. */
const pendingText = () =>
  [...card().querySelectorAll('.invisible')].map((element) => element.textContent).join('');

/** Brings the card near the viewport and waits for the controller to replace the static render. */
async function loadController({ onScreen }: { onScreen: boolean }) {
  const staticButton = button('Play the session');
  page.show(onScreen ? 0.6 : 0, { near: true });
  await waitFor(() => expect(staticButton).not.toBeInTheDocument(), controllerLoad);
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

describe('the 3D scene’s beats', () => {
  const frames = buildFrames(steps);
  const beats = frames.map((frame) => sceneBeat(steps, frame));

  it('starts on the history and ends on the loop, never stepping back', () => {
    expect(beats[0]).toBe(0);
    expect(beats.at(-1)).toBe(sceneBeats.length - 1);
    expect(sceneBeat(steps, finalFrame(steps))).toBe(sceneBeats.length - 1);
    beats.slice(1).forEach((beat, i) => expect(beat).toBeGreaterThanOrEqual(beats[i]!));
  });

  it('reaches every beat, one at a time', () => {
    expect([...new Set(beats)]).toEqual(sceneBeats.map((_, index) => index));
  });

  it('marks a run only once its result is in, and offers the reflex as the terminal does', () => {
    const reflex = steps.findIndex((step) => step.kind === 'reflex');
    frames.forEach((frame, index) => {
      const beat = sceneBeats[beats[index]!]!;
      const results = steps.filter(
        (step, i) => step.kind === 'run' && beatsShown(frame, i) >= beatCount(step),
      ).length;
      expect(beat.runs).toBe(results);
      expect(beat.offered).toBe(beatsShown(frame, reflex) >= 1);
    });
  });

  it('draws only plain strings from the content', () => {
    const data = reflexSceneData();
    expect(data.stages).toEqual(adage.pipeline);
    expect(data.parts).toEqual(['Condition', 'Response', 'Evidence']);
    expect(data.command).toBe(knownCommand);
    expect(data.runs).toEqual([false, false, true]);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

describe('<ReflexDemo />', () => {
  it('server-renders the finished session, its transcript and the pipeline', () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);

    // The pipeline's stage comes first, above the terminal; the transcript follows the terminal.
    const [pipeline, story] = within(card()).getAllByRole('list');
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
    expect(card().querySelector('div[aria-hidden="true"].font-mono')).toHaveTextContent(
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
    expect(button('Pause the session')).toBeInTheDocument();
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
    expect(screen.getByText('Full session')).toBeInTheDocument();
    fireEvent.click(button('Play the session'));
    expect(pendingText()).not.toBe('');
    expect(button('Pause the session')).toBeInTheDocument();
  });

  it('pauses and resumes from the same control every tour has', async () => {
    mockReducedMotion(false);
    render(<ReflexDemo />);
    await loadController({ onScreen: false });
    vi.useFakeTimers();
    page.show(1);

    act(() => vi.runOnlyPendingTimers());
    const control = button('Pause the session');
    act(() => control.focus());
    fireEvent.click(control);
    const shown = pendingText();
    // The same button changes its label, so focus stays on it.
    expect(button('Play the session')).toBe(control);
    expect(control).toHaveFocus();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(pendingText()).toBe(shown);

    fireEvent.click(control);
    playToEnd();
    expect(pendingText()).toBe('');
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
    expect(button('Pause the session')).toBeInTheDocument();
  });
});
