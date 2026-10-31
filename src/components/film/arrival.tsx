import { getImageProps } from 'next/image';
import type { ReactNode } from 'react';
import { PlayIcon } from '@/components/visuals/shared/icons';
import { film, person } from '@/content/profile';
import styles from './arrival.module.css';
import { ArrivalShell } from './arrival-shell';
import { poster, scenes, timecode } from './media';
import { ScenesDialog } from './scenes-dialog';
import { sceneNotes } from './scene-notes';
import { closesTheater } from './theater';

// The theater's screen: up to 68rem wide, else the viewport less the dialog's padding.
const posterSizes = '(min-width: 1152px) 1088px, (min-width: 640px) calc(100vw - 64px), 100vw';

const titleId = 'arrival-title';
const scenesTitleId = 'arrival-scenes-title';
const chip = `${film.title} · 0:${film.seconds}`;

const closeButton =
  '-mr-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg';

/** Four corners pointing out: open the film bigger, in the theater. */
function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9.5 6.5M2.5 13.5l4-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

interface ArrivalProps {
  /** The headshot, rendered by the hero: the frame's resting image. */
  portrait: ReactNode;
  /** The frame's place and size in the hero's grid. */
  className: string;
}

/**
 * Arrival, the 16-second film that opens the hero. Everything here renders on the server: the
 * frame around the portrait, the theater's title and notes, and the scene-by-scene text
 * alternative, which stays in the page's HTML. The shell adds the behaviour.
 */
export function Arrival({ portrait, className }: ArrivalProps) {
  // The optimizer's srcset as a plain <img>: no image component in the client bundle. It renders
  // only once the theater opens, over its blurred placeholder, which the player draws itself.
  // Lazy, because an eager <img> anywhere in the payload gets a preload in the page's head; in
  // the open theater it loads at once.
  const { props: image } = getImageProps({
    src: poster.src,
    alt: '',
    fill: true,
    sizes: posterSizes,
  });

  return (
    <ArrivalShell
      portrait={portrait}
      className={className}
      // The name includes the badge's words, "Arrival · 0:16", as voice control users say them.
      chipLabel={`Play ${chip}, a ${film.seconds}-second film`}
      chip={
        // Below md the chip is a badge on the avatar, the icon alone; the button is the frame.
        <span className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full border border-line bg-surface text-fg shadow-card transition-colors group-hover:bg-elevated md:right-auto md:bottom-3 md:left-3 md:flex md:size-auto md:h-8 md:gap-1.5 md:bg-surface/85 md:px-3 md:backdrop-blur md:group-hover:bg-surface">
          <PlayIcon width={10} height={10} className={styles.play} />
          <ExpandIcon className={styles.expand} />
          <span className="label hidden text-fg md:inline">{chip}</span>
        </span>
      }
      titleId={titleId}
      heading={
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="label">Film · {film.duration}</p>
            <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight">
              {film.title}
            </h2>
          </div>
          <button type="button" aria-label="Close" {...closesTheater} className={closeButton}>
            <CloseIcon />
          </button>
        </div>
      }
      unavailable={
        <p
          role="status"
          className="grid aspect-video place-items-center rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted"
        >
          The film couldn’t load. Check your connection and try again, or read it scene by scene.
        </p>
      }
      player={{
        label: film.title,
        caption: film.duration,
        // eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies the optimized sources
        poster: <img {...image} alt="" className="object-cover" />,
        // The end plate itself comes with the player's code (film-view.tsx): it shows at the end.
        signature: person.name,
      }}
      details={
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {film.body} <span className="text-subtle">{film.note}</span>
          </p>
          <ScenesDialog labelledBy={scenesTitleId}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label">Film / {film.title}</p>
                <h3 id={scenesTitleId} className="mt-2 text-xl font-semibold tracking-tight">
                  Scene by scene
                </h3>
              </div>
              <form method="dialog">
                <button aria-label="Close" className={`-mt-1 ${closeButton}`}>
                  <CloseIcon />
                </button>
              </form>
            </div>

            <ol className="mt-6 space-y-4 border-l border-line pl-4 text-sm leading-relaxed text-muted">
              {scenes.map((scene) => (
                <li key={scene.start}>
                  <p className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-subtle tabular-nums">
                      {timecode(scene.start)}
                    </span>
                    <span className="font-medium text-fg">{scene.title}</span>
                  </p>
                  <p className="mt-1">{sceneNotes[scene.title]}</p>
                </li>
              ))}
              <li>
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-subtle">End</span>
                  <span className="font-medium text-fg">The workspace</span>
                </p>
                <p className="mt-1">
                  The screen wakes into a terminal: “Welcome to my workspace.” In the hero’s frame,
                  the film ends on Steven’s portrait instead.
                </p>
              </li>
            </ol>
          </ScenesDialog>
        </div>
      }
    />
  );
}
