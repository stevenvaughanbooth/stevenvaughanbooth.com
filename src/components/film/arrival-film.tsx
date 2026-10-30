import { getImageProps } from 'next/image';
import { film } from '@/content/profile';
import { EndPlate, nextSection } from './end-plate';
import { FilmShell } from './film-shell';
import { FilmView } from './film-view';
import { filmDuration, poster, scenes, timecode } from './media';
import { ScenesDialog } from './scenes-dialog';
import { sceneNotes } from './scene-notes';

// The film's column in the Interlude grid (see sections/interlude.tsx): 26rem from md, 30rem
// from lg, the page width below md.
const posterSizes = '(min-width: 1024px) 480px, (min-width: 768px) 416px, calc(100vw - 40px)';

const scenesTitleId = 'film-scenes-title';

export function ArrivalFilm() {
  // The optimizer's srcset and blur placeholder as a plain <img>: no image component in the
  // client bundle. It loads lazily, as the film sits below the fold.
  const { props: image } = getImageProps({
    src: poster.src,
    alt: '',
    fill: true,
    sizes: posterSizes,
    placeholder: 'blur',
    blurDataURL: poster.blurDataURL,
  });
  const content = {
    label: film.title,
    caption: film.duration,
    // eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies the optimized sources
    poster: <img {...image} alt="" className="object-cover" />,
    endPlate: <EndPlate />,
  };

  return (
    <div>
      <FilmShell
        {...content}
        staticPlayer={
          <FilmView {...content} status="idle" time={0} duration={filmDuration} hasFrame={false} />
        }
      />

      <ScenesDialog labelledBy={scenesTitleId}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">
              {film.kicker} / {film.title}
            </p>
            <h3 id={scenesTitleId} className="mt-2 text-xl font-semibold tracking-tight">
              Scene by scene
            </h3>
          </div>
          <form method="dialog">
            <button
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
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
              The screen wakes into a terminal: “Welcome to my workspace.”
              {nextSection ? ` Its link continues to ${nextSection.label}.` : null}
            </p>
          </li>
        </ol>
      </ScenesDialog>
    </div>
  );
}
