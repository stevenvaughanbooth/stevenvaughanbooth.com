import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { film } from '@/content/profile';
import { mockIntersectionObserver } from '@/test/browser-mocks';
import { ArrivalFilm } from './arrival-film';
import { scenes, sources } from './media';
import { sceneNotes } from './scene-notes';

let page: ReturnType<typeof mockIntersectionObserver>;
let play: MockInstance<HTMLMediaElement['play']>;
let pause: MockInstance<HTMLMediaElement['pause']>;

function renderFilm() {
  const view = render(<ArrivalFilm />);
  const video = () => view.container.querySelector('video')!;
  return { ...view, video };
}

/** Brings the film near the viewport and waits for the controller to replace the static player. */
async function loadController() {
  const staticPlay = screen.getByRole('button', { name: 'Play film' });
  page.show(0, { near: true });
  await waitFor(() => expect(staticPlay).not.toBeInTheDocument());
}

beforeEach(() => {
  page = mockIntersectionObserver();
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((type) =>
    type.includes('av01') ? 'probably' : 'maybe',
  );
});

afterEach(() => {
  // jsdom has no showModal; one test supplies it.
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ArrivalFilm', () => {
  it('server-renders an idle player with one play control that downloads nothing', () => {
    const { video, container } = renderFilm();
    expect(video().getAttribute('src')).toBeNull();
    expect(video().querySelector('source')).toBeNull();
    expect(video()).toHaveAttribute('preload', 'none');
    expect(screen.getAllByRole('button', { name: /play/i })).toHaveLength(1);
    expect(screen.getByText(film.duration)).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Film position' })).toBeDisabled();
    // The poster is a plain, lazy <img> with the optimizer's sources.
    const poster = container.querySelector('img')!;
    expect(poster).toHaveAttribute('loading', 'lazy');
    expect(poster.getAttribute('srcset')).toContain('/_next/image?url=%2Ffilm%2F');
  });

  it('loads the best supported encode on Play, from the keyboard', async () => {
    const { video } = renderFilm();
    await loadController();
    screen.getByRole('button', { name: 'Play film' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(video().getAttribute('src')).toBe(sources[0].src);
    expect(play).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Loading the film');
    fireEvent.playing(video());
    expect(screen.getByRole('button', { name: 'Pause film' })).toHaveFocus();
  });

  it('keeps a press on Play made before the controller arrives', async () => {
    const { video } = renderFilm();
    fireEvent.click(screen.getByRole('button', { name: 'Play film' }));
    expect(play).not.toHaveBeenCalled();
    await loadController();
    expect(video().getAttribute('src')).toBe(sources[0].src);
    expect(play).toHaveBeenCalledOnce();
  });

  it('falls back to H.264, then shows a retry when nothing plays', async () => {
    const { video } = renderFilm();
    await loadController();
    await userEvent.click(screen.getByRole('button', { name: 'Play film' }));
    fireEvent.error(video());
    expect(video().getAttribute('src')).toBe(sources[1].src);
    fireEvent.error(video());
    expect(screen.getByRole('status')).toHaveTextContent('The film couldn’t load.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(video().getAttribute('src')).toBe(sources[0].src);
  });

  it('ends on the terminal plate, which leads on to the next section', async () => {
    const { video } = renderFilm();
    await loadController();
    await userEvent.click(screen.getByRole('button', { name: 'Play film' }));
    fireEvent.playing(video());
    expect(screen.queryByRole('link', { name: /continue/i })).toBeNull();
    fireEvent.ended(video());
    expect(screen.getByRole('link', { name: 'Continue to Experience' })).toHaveAttribute(
      'href',
      '#experience',
    );
    expect(screen.getByRole('button', { name: 'Replay film' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('The film has ended.');
  });

  it('pauses while scrolled away and resumes on return', async () => {
    renderFilm();
    await loadController();
    await userEvent.click(screen.getByRole('button', { name: 'Play film' }));
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    page.show(1);
    page.show(0);
    expect(pause).toHaveBeenCalledOnce();
    page.show(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('describes every scene in a modal dialog', async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: showModal,
      configurable: true,
    });
    renderFilm();

    await userEvent.click(screen.getByRole('button', { name: 'Scene by scene' }));
    expect(showModal).toHaveBeenCalledOnce();
    const dialog = screen.getByRole('dialog', { name: 'Scene by scene' });
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(scenes.length + 1);
    scenes.forEach((scene, i) => {
      expect(items[i]).toHaveTextContent(scene.title);
      expect(items[i]).toHaveTextContent(sceneNotes[scene.title]);
    });
    expect(within(dialog).getByRole('button', { name: 'Close' }).closest('form')).toHaveAttribute(
      'method',
      'dialog',
    );
  });
});
