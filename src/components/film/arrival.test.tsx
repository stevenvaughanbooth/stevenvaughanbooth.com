import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { film, person } from '@/content/profile';
import { mockIntersectionObserver } from '@/test/browser-mocks';
import { Arrival } from './arrival';
import styles from './arrival.module.css';
import { frameQuery } from './autoplay';
import { frameSources, poster, scenes, sources } from './media';
import { sceneNotes } from './scene-notes';

// The chip's name includes what it shows, "Arrival · 0:16".
const chipName = `Play ${film.title} · 0:16, a 16-second film`;

let page: ReturnType<typeof mockIntersectionObserver>;
let play: MockInstance<HTMLMediaElement['play']>;
let pause: MockInstance<HTMLMediaElement['pause']>;
let showModal: ReturnType<typeof vi.fn>;

/** Answers the frame's queries: is the viewport md or wider, and is motion welcome. */
function stubMedia({ wide = true, reduce = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query === frameQuery && wide) ||
      (query.includes('prefers-reduced-motion: no-preference') && !reduce) ||
      (query.includes('prefers-reduced-motion: reduce') && reduce),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function renderArrival() {
  // eslint-disable-next-line @next/next/no-img-element -- stands in for the hero's portrait
  const portrait = <img src="/headshot.jpg" alt="Portrait of Steven Booth" />;
  const view = render(<Arrival portrait={portrait} className="" />);
  const chip = screen.getByRole('button', { name: chipName });
  const dialog = view.container.querySelector('dialog')!;
  const frameVideo = () => view.container.querySelector<HTMLVideoElement>('#film > div video');
  const theaterVideo = () => dialog.querySelector('video');
  return { ...view, chip, dialog, frameVideo, theaterVideo };
}

/** Brings the frame on screen and waits until its film has a source and was asked to play. */
async function frameFilmStarts(frameVideo: () => HTMLVideoElement | null) {
  page.show(1);
  await waitFor(() => expect(frameVideo()).toHaveAttribute('src'));
  return frameVideo()!;
}

/** Opens the theater from the chip and waits for its player. */
async function openTheater(chip: HTMLElement, dialog: HTMLDialogElement) {
  await userEvent.click(chip);
  await waitFor(() => expect(dialog.querySelector('video')).not.toBeNull());
}

beforeAll(async () => {
  // The shell imports these on demand. Load them once here, so no test's wait includes the
  // first transform of a module (slow when the whole suite runs in parallel).
  await Promise.all([import('./frame-film'), import('./film-controller')]);
});

beforeEach(() => {
  page = mockIntersectionObserver();
  stubMedia();
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type) =>
    type.includes('av01') ? 'probably' : 'maybe',
  );
  // jsdom has no modal dialogs: showModal and close toggle `open`, as the browser would.
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: showModal,
    configurable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    }),
    configurable: true,
  });
});

afterEach(() => {
  // Unmount while the fakes are still in place: unmounting flushes any effect still pending.
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Arrival in the hero', () => {
  it('paints the portrait with no video, and a chip that opens the theater', () => {
    const { chip, dialog, frameVideo, container } = renderArrival();
    expect(screen.getByRole('img', { name: 'Portrait of Steven Booth' })).toBeVisible();
    expect(container.querySelector('video')).toBeNull();
    expect(frameVideo()).toBeNull();
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog');
    expect(chip).toHaveTextContent(`${film.title} · 0:16`);
    // Play at rest; Expand while the film plays in the frame, which CSS switches (the module).
    const icons = chip.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass(styles.play!);
    expect(icons[1]).toHaveClass(styles.expand!);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(dialog).not.toHaveAttribute('open');
    // The text alternative is in the server's HTML, inside the theater.
    for (const scene of scenes) expect(dialog).toHaveTextContent(sceneNotes[scene.title]);
  });

  it('plays the 4:5 cut once the page has settled, with a pause control', async () => {
    const { frameVideo } = renderArrival();
    const video = await frameFilmStarts(frameVideo);
    expect(video.getAttribute('src')).toBe(frameSources[0].src);
    expect(video).toHaveAttribute('aria-hidden', 'true');
    expect(play).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('arrival:seen')).not.toBeNull();

    // Nothing to pause until the first frame shows.
    expect(screen.queryByRole('button', { name: 'Pause film' })).toBeNull();
    fireEvent.playing(video);
    expect(video).toHaveAttribute('data-shown');

    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Pause film' }));
    expect(pause).toHaveBeenCalledOnce();
    fireEvent.pause(video);
    expect(screen.getByRole('button', { name: 'Resume film' })).toBeInTheDocument();
  });

  it('waits until the frame is on screen, and pauses while it is scrolled away', async () => {
    const { frameVideo } = renderArrival();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(frameVideo()).toBeNull();
    await frameFilmStarts(frameVideo);

    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    page.show(0);
    expect(pause).toHaveBeenCalledOnce();
    page.show(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['on a small screen, where the portrait is an avatar', { wide: false }],
    ['under reduced motion', { reduce: true }],
  ])('never plays by itself %s', async (_, media) => {
    stubMedia(media);
    const { frameVideo } = renderArrival();
    page.show(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(frameVideo()).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('lands on the portrait, and hands focus from its pause control to the chip', async () => {
    const { chip, frameVideo } = renderArrival();
    const video = await frameFilmStarts(frameVideo);
    fireEvent.playing(video);
    screen.getByRole('button', { name: 'Pause film' }).focus();

    fireEvent.ended(video);
    expect(video).not.toHaveAttribute('data-shown');
    fireEvent.transitionEnd(video, { propertyName: 'opacity' });
    expect(frameVideo()).toBeNull();
    expect(chip).toHaveFocus();
    expect(screen.getByRole('img', { name: 'Portrait of Steven Booth' })).toBeVisible();
  });

  it('stays on the portrait when the browser refuses to play', async () => {
    play.mockRejectedValue(new DOMException('Autoplay is not allowed', 'NotAllowedError'));
    const { frameVideo } = renderArrival();
    page.show(1);
    await waitFor(() => expect(play).toHaveBeenCalled());
    await waitFor(() => expect(frameVideo()).toBeNull());
  });
});

describe('Arrival in the theater', () => {
  it('opens from the chip as a modal dialog that plays the full film, focused on its control', async () => {
    const { chip, dialog, theaterVideo } = renderArrival();
    await openTheater(chip, dialog);

    expect(showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: film.title })).toBe(dialog);
    expect(theaterVideo()?.getAttribute('src')).toBe(sources[0].src);
    expect(play).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Pause film' })).toHaveFocus(),
    );
  });

  it('stops the frame’s film for good when the theater opens', async () => {
    const { chip, dialog, frameVideo } = renderArrival();
    await frameFilmStarts(frameVideo);
    await openTheater(chip, dialog);
    // Hidden with the frame at once, then removed once React renders the hidden frame.
    expect(pause).toHaveBeenCalled();
    await waitFor(() => expect(frameVideo()).toBeNull());

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    page.show(0);
    page.show(1);
    expect(frameVideo()).toBeNull();
  });

  it('closes on Escape and returns focus to the chip', async () => {
    const { chip, dialog, theaterVideo } = renderArrival();
    await openTheater(chip, dialog);

    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(theaterVideo()).toBeNull();
    expect(chip).toHaveFocus();
  });

  it('draws the poster’s blurred placeholder only once it opens', async () => {
    const { chip, dialog } = renderArrival();
    expect(dialog.innerHTML).not.toContain(poster.blurDataURL);
    await openTheater(chip, dialog);
    const placeholder = [...dialog.querySelectorAll<HTMLElement>('[aria-hidden]')].find((element) =>
      element.style.backgroundImage.includes(poster.blurDataURL),
    );
    expect(placeholder).toBeDefined();
  });

  it('closes from its Close button and from the end plate', async () => {
    const { chip, dialog, theaterVideo } = renderArrival();
    await openTheater(chip, dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));

    await openTheater(chip, dialog);
    fireEvent.playing(theaterVideo()!);
    expect(within(dialog).queryByRole('button', { name: /continue/i })).toBeNull();
    fireEvent.ended(theaterVideo()!);
    expect(within(dialog).getByRole('status')).toHaveTextContent('The film has ended.');
    expect(within(dialog).getByText(person.name)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to the site' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(chip).toHaveFocus();
  });

  it('falls back to H.264, then shows a retry when nothing plays', async () => {
    const { chip, dialog, theaterVideo } = renderArrival();
    await openTheater(chip, dialog);
    fireEvent.error(theaterVideo()!);
    expect(theaterVideo()?.getAttribute('src')).toBe(sources[1].src);
    fireEvent.error(theaterVideo()!);
    expect(within(dialog).getByRole('status')).toHaveTextContent('The film couldn’t load.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(theaterVideo()?.getAttribute('src')).toBe(sources[0].src);
  });

  it('describes every scene in a modal dialog of its own', async () => {
    const { chip, dialog } = renderArrival();
    await openTheater(chip, dialog);
    showModal.mockClear();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Scene by scene' }));
    expect(showModal).toHaveBeenCalledOnce();
    const scenesDialog = screen.getByRole('dialog', { name: 'Scene by scene' });
    const items = within(scenesDialog).getAllByRole('listitem');
    expect(items).toHaveLength(scenes.length + 1);
    scenes.forEach((scene, i) => {
      expect(items[i]).toHaveTextContent(scene.title);
      expect(items[i]).toHaveTextContent(sceneNotes[scene.title]);
    });
    expect(
      within(scenesDialog).getByRole('button', { name: 'Close' }).closest('form'),
    ).toHaveAttribute('method', 'dialog');

    // Closing the scenes leaves the theater open.
    act(() => (scenesDialog as HTMLDialogElement).close());
    expect(dialog).toHaveAttribute('open');
  });

  it('closes the scenes on a press on their backdrop, not on their box', async () => {
    const { chip, dialog } = renderArrival();
    await openTheater(chip, dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Scene by scene' }));
    const scenesDialog = screen.getByRole('dialog', { name: 'Scene by scene' });
    vi.spyOn(scenesDialog, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 100, width: 300, height: 400 }),
    );

    // The dialog's padding: inside its box.
    fireEvent.click(scenesDialog, { clientX: 120, clientY: 120 });
    expect(scenesDialog).toHaveAttribute('open');
    // Its backdrop: the same element, outside the box.
    fireEvent.click(scenesDialog, { clientX: 20, clientY: 20 });
    expect(scenesDialog).not.toHaveAttribute('open');
    expect(dialog).toHaveAttribute('open');
  });
});
