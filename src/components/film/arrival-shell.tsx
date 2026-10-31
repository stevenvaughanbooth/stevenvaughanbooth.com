'use client';

import {
  Activity,
  addTransitionType,
  type MouseEvent,
  type ReactNode,
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  ViewTransition,
} from 'react';
import { useInView } from '@/components/visuals/shared/hooks';
import styles from './arrival.module.css';
import { mayPlayInFrame, whenSettled } from './autoplay';
import type { FilmContent } from './film-view';
import { morph } from './theater';

const loadFrameFilm = () => import('./frame-film');
const loadPlayer = () => import('./film-controller');

type FrameFilmModule = Awaited<ReturnType<typeof loadFrameFilm>>;
type PlayerModule = Awaited<ReturnType<typeof loadPlayer>>;

interface ArrivalShellProps {
  /** The headshot: what the frame paints first and comes back to. The page's LCP element. */
  portrait: ReactNode;
  /** The chip's badge, and its accessible name, which includes the words the badge shows. */
  chip: ReactNode;
  chipLabel: string;
  /**
   * The theater's header (its heading has `titleId`, its Close button `closesTheater`), its notes
   * below the player (with the `opensScenes` button and its dialog), and the notice that replaces
   * the player if the player can't load.
   */
  heading: ReactNode;
  titleId: string;
  details: ReactNode;
  unavailable: ReactNode;
  /** What the server hands the theater's player: its labels, poster and the end plate's name. */
  player: FilmContent;
  /** The frame's place and size in the hero's grid. */
  className: string;
}

/**
 * The film's code in the initial page: the hero's portrait frame, its chip and the theater.
 *
 * The frame paints the portrait first. Once the page has loaded and gone idle, if the frame is
 * big enough and on screen, motion is welcome and data is not scarce, it loads the 4:5 cut and
 * plays it once over the portrait (frame-film.tsx). The chip, which covers the whole frame,
 * opens the theater: a modal <dialog> with the full film, its controls and "Scene by scene". The
 * player's code, with its poster and end plate, downloads as a pointer or focus reaches the chip,
 * and the theater opens in one transition with it, so the frame morphs into the theater's screen
 * (theater.ts) and back on close. Opening, closing and the scenes stay here, so the theater and
 * its text alternative still work if the player can't load.
 */
export function ArrivalShell({
  portrait,
  chip,
  chipLabel,
  heading,
  titleId,
  details,
  unavailable,
  player,
  className,
}: ArrivalShellProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [frameFilm, setFrameFilm] = useState<FrameFilmModule | null>(null);
  const [theater, setTheater] = useState<PlayerModule | null>(null);
  const [open, setOpen] = useState(false);
  // The frame plays the film at most once: 'waiting' once the page has settled, until in view.
  const stage = useRef<'idle' | 'waiting' | 'started' | 'done'>('idle');
  const inView = useRef(false);

  function startFrameFilm() {
    if (stage.current !== 'waiting' || !inView.current) return;
    stage.current = 'started';
    loadFrameFilm().then(
      (loaded) => {
        if (stage.current === 'started') setFrameFilm(loaded);
      },
      () => {
        stage.current = 'done';
      },
    );
  }

  const onSettled = useEffectEvent(() => {
    stage.current = 'waiting';
    startFrameFilm();
  });
  useEffect(() => {
    if (!mayPlayInFrame(window)) return;
    return whenSettled(window, () => onSettled());
  }, []);

  useInView(frameRef, {
    threshold: 0.6,
    onChange(next) {
      inView.current = next;
      startFrameFilm();
    },
  });

  function endFrameFilm() {
    stage.current = 'done';
    // Its pause control may have focus; hand it to the chip rather than lose it.
    if (mediaRef.current?.contains(document.activeElement)) chipRef.current?.focus();
    setFrameFilm(null);
  }

  function preloadPlayer() {
    loadPlayer().catch(() => {});
  }

  // Opening and closing run as transitions, which is what lets <ViewTransition> animate them.
  // Their type keeps the site header in the page's snapshot (globals.css), under the theater.
  // Under reduced motion they are plain updates: the theater appears and goes, with no morph.
  function transition(update: () => void) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) update();
    else
      startTransition(() => {
        addTransitionType('arrival');
        update();
      });
  }

  async function openTheater() {
    if (open) return;
    // The player must be in hand before the transition, so it mounts in the same commit as the
    // frame hides, and the two pair up. If its code can't load, the theater says so instead.
    const loaded = await loadPlayer().catch(() => null);
    transition(() => {
      stage.current = 'done';
      setFrameFilm(null);
      setTheater(loaded);
      setOpen(true);
    });
  }

  function closeTheater() {
    transition(() => setOpen(false));
  }

  // Inside the transition's update: the dialog is shown or closed in the same frame as the DOM
  // changes, so the morph captures it. showModal() makes the page inert and traps focus.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      chipRef.current?.focus();
    }
  }, [open]);

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    const target = event.target;
    // The dialog fills the viewport: a press on it, not its content, is a press on the backdrop.
    // Server-rendered controls marked with `closesTheater` close it too.
    if (target === event.currentTarget) closeTheater();
    else if (target instanceof HTMLDialogElement) closeOnBackdrop(target, event);
    else if (target instanceof Element && target.closest('[data-close]')) closeTheater();
    else if (target instanceof Element && target.closest('[data-scenes]')) {
      event.currentTarget.querySelector('dialog')?.showModal();
    }
  }

  return (
    <div
      ref={frameRef}
      id="film"
      data-component="arrival"
      className={`relative rounded-2xl border border-line bg-elevated shadow-card md:rounded-3xl ${className}`}
    >
      <Activity mode={open ? 'hidden' : 'visible'}>
        <ViewTransition {...morph}>
          <div
            ref={mediaRef}
            className={`${styles.media} absolute inset-0 overflow-hidden rounded-[inherit]`}
          >
            {portrait}
            {frameFilm ? <frameFilm.FrameFilm onDone={endFrameFilm} /> : null}
          </div>
        </ViewTransition>
      </Activity>

      <button
        ref={chipRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={chipLabel}
        onClick={openTheater}
        onPointerEnter={preloadPlayer}
        onFocus={preloadPlayer}
        className="group absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
      >
        {chip}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          // Escape: close through the transition, so the screen morphs back into the frame.
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          closeTheater();
        }}
        onClose={(event) => {
          // Closed by the browser itself; the nested "Scene by scene" dialog closes on its own.
          if (event.target === event.currentTarget) setOpen(false);
        }}
        onClick={onDialogClick}
        className="m-0 size-full max-h-none max-w-none overflow-y-auto overscroll-contain bg-transparent p-4 text-fg backdrop:bg-bg/90 backdrop:backdrop-blur-md open:grid open:place-items-center-safe sm:p-8"
      >
        <div className="w-full max-w-[min(68rem,calc((100dvh-16rem)*16/9))] min-w-0">
          {heading}
          {open ? (
            theater ? (
              <theater.Theater fallback={unavailable} {...player} />
            ) : (
              unavailable
            )
          ) : null}
          {details}
        </div>
      </dialog>
    </div>
  );
}

/**
 * A press on the "Scene by scene" dialog's backdrop: the click lands on the dialog itself, outside
 * its box (inside it, the press is on its padding).
 */
function closeOnBackdrop(dialog: HTMLDialogElement, event: MouseEvent) {
  const box = dialog.getBoundingClientRect();
  const inside =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom;
  if (!inside) dialog.close();
}
