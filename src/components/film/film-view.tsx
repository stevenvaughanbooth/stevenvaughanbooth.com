import type { KeyboardEvent, ReactNode, Ref, VideoHTMLAttributes } from 'react';
import { PauseIcon, PlayIcon, ReplayIcon } from '@/components/visuals/shared/icons';
import { type Scene, sceneAt, scenes, timecode } from './media';

export type FilmStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/** Rendered once on the server and passed once: the static player and the controller share it. */
export interface FilmContent {
  /** Accessible name for the video. */
  label: string;
  /** Shown on the poster before Play, e.g. "16 seconds · soundless", and read before the controls. */
  caption: string;
  /** Server-rendered poster image, covering the frame until the first video frame. */
  poster: ReactNode;
  /** Server-rendered plate shown over the final frame. */
  endPlate: ReactNode;
}

/** The controller's wiring. The static render has none: it is the idle player, inert. */
export interface FilmControls {
  cardRef: Ref<HTMLDivElement>;
  video: VideoHTMLAttributes<HTMLVideoElement> & { ref: Ref<HTMLVideoElement> };
  onToggle: () => void;
  onSeek: (time: number) => void;
  onSeekKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface FilmViewProps extends FilmContent {
  status: FilmStatus;
  time: number;
  duration: number;
  /** The first video frame has painted, so the poster fades out. */
  hasFrame: boolean;
  controls?: FilmControls;
}

const icon = { width: 18, height: 18 };

const announcements: Partial<Record<FilmStatus, string>> = {
  loading: 'Loading the film…',
  ended: 'The film has ended.',
  error: 'The film couldn’t load.',
};

/**
 * The player: the frame (video, poster, and the loading, end and error states) above a control
 * bar with the one play control, the chapter title, the position slider and the timecode.
 * Elements marked data-play are what a click before the controller loads should start.
 */
export function FilmView({
  label,
  caption,
  poster,
  endPlate,
  status,
  time,
  duration,
  hasFrame,
  controls,
}: FilmViewProps) {
  const started = status !== 'idle';
  const playing = status === 'playing' || status === 'loading';
  const progress = duration > 0 ? Math.min(time / duration, 1) : 0;
  const scene = sceneAt(time);

  return (
    <div
      ref={controls?.cardRef}
      className="@container overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <div className="@container relative aspect-video overflow-hidden bg-elevated">
        <video
          {...controls?.video}
          data-play
          aria-label={label}
          muted
          playsInline
          preload={started ? 'auto' : 'none'}
          className="absolute inset-0 size-full cursor-pointer object-cover"
          onClick={controls?.onToggle}
        />

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${hasFrame ? 'opacity-0' : ''}`}
        >
          {poster}
        </div>

        {status === 'idle' && (
          <p className="label pointer-events-none absolute top-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-muted shadow-card backdrop-blur">
            {caption}
          </p>
        )}

        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface/90 px-4 py-2 font-mono text-xs text-muted shadow-card backdrop-blur">
              <span className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-green" />
              Loading
            </span>
          </div>
        )}

        {status === 'ended' && endPlate}

        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-bg/75 p-4 backdrop-blur-sm">
            <div className="max-w-xs rounded-2xl border border-line bg-surface p-5 text-center shadow-card">
              <p className="text-sm font-medium">The film couldn’t load.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Check your connection and try again, or read it scene by scene.
              </p>
              <button
                type="button"
                onClick={controls?.onToggle}
                className="mt-4 inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm font-medium transition-colors hover:bg-elevated"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-3 py-2 @sm:gap-4 @sm:px-4">
        <button
          type="button"
          data-play
          onClick={controls?.onToggle}
          aria-label={playing ? 'Pause film' : status === 'ended' ? 'Replay film' : 'Play film'}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-fg text-bg transition-transform hover:scale-105 forced-colors:border"
        >
          {playing ? (
            <PauseIcon {...icon} />
          ) : status === 'ended' ? (
            <ReplayIcon {...icon} />
          ) : (
            <PlayIcon {...icon} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <SceneTitle current={scene} />
          <div className="flex items-center gap-3">
            <div className="group relative h-6 min-w-0 flex-1">
              <input
                type="range"
                aria-label="Film position"
                aria-valuetext={`${time.toFixed(1)} of ${duration.toFixed(1)} seconds: ${scene.title}`}
                min={0}
                max={duration}
                step="any"
                value={time}
                disabled={!started || status === 'error'}
                onChange={
                  controls && ((event) => controls.onSeek(event.currentTarget.valueAsNumber))
                }
                onKeyDown={controls?.onSeekKey}
                className="peer absolute inset-0 z-10 w-full cursor-pointer opacity-0 disabled:cursor-default"
              />
              {/* Under forced colours the track keeps an outline and the played part a system colour. */}
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-green forced-colors:h-1.5 forced-colors:border">
                <div
                  className={`h-full origin-left rounded-full bg-green forced-color-adjust-none forced-colors:bg-[Highlight] ${status === 'playing' ? 'transition-transform duration-300 ease-linear' : ''}`}
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
              {started && status !== 'error' && (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 ${status === 'playing' ? 'transition-transform duration-300 ease-linear' : ''}`}
                  style={{ transform: `translateX(${progress * 100}%)` }}
                >
                  <span className="absolute top-1/2 left-0 size-3 -translate-1/2 rounded-full border-2 border-surface bg-fg transition-transform forced-color-adjust-none group-hover:scale-125 forced-colors:border-[Canvas] forced-colors:bg-[CanvasText]" />
                </div>
              )}
            </div>
            <p aria-hidden className="shrink-0 font-mono text-xs text-muted tabular-nums">
              {timecode(time)} / {timecode(duration)}
            </p>
          </div>
        </div>

        <span className="sr-only" role="status">
          {announcements[status]}
        </span>
      </div>
    </div>
  );
}

/**
 * Every chapter title in one grid cell, only the current one visible: titles wrap on a narrow
 * card instead of truncating, and the bar is as tall as the longest, so it never moves in play.
 */
function SceneTitle({ current }: { current: Scene }) {
  return (
    <p className="label grid tracking-[0.06em] @sm:tracking-[0.12em]">
      {scenes.map((scene) => (
        <span
          key={scene.start}
          className={`col-start-1 row-start-1 ${scene === current ? '' : 'invisible'}`}
        >
          {scene.title}
        </span>
      ))}
    </p>
  );
}
