import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useInView } from '@/components/visuals/shared/hooks';
import { PauseIcon, PlayIcon } from '@/components/visuals/shared/icons';
import { markPlayed } from './autoplay';
import { frameSources, pickSource } from './media';

interface FrameFilmProps {
  /** The film has faded back to the portrait, or could not play at all. */
  onDone: () => void;
}

/**
 * Loaded by the hero's shell once the page has settled: the 4:5 cut, playing once, muted, over
 * the portrait. It fades in on its first frame and, at the end, fades out onto the portrait. It
 * pauses while scrolled away, and has its own pause control, since it moves for 16 seconds
 * (WCAG 2.2.2). The video is decorative here; the chip's theater is the film with its controls
 * and its text alternative.
 */
export function FrameFilm({ onDone }: FrameFilmProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceIndex = useRef(0);
  const autoPaused = useRef(false);
  const [shown, setShown] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState(false);
  const refused = useEffectEvent(onDone);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.getAttribute('src')) {
      sourceIndex.current = pickSource(video, frameSources);
      video.src = frameSources[sourceIndex.current]?.src ?? '';
      markPlayed(window);
    }
    // A refusal (an autoplay policy, a low-power mode) leaves the portrait as it is.
    video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') refused();
    });
    // Opening the theater hides the frame in an <Activity> before this unmounts: stop here.
    return () => video.pause();
  }, []);

  useInView(videoRef, {
    onChange(inView) {
      const video = videoRef.current;
      if (!video || video.ended) return;
      if (!inView && !video.paused) {
        autoPaused.current = true;
        video.pause();
      } else if (inView && autoPaused.current) {
        autoPaused.current = false;
        video.play().catch(() => {});
      }
    },
  });

  function toggle() {
    const video = videoRef.current;
    if (!video || ending) return;
    autoPaused.current = false;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  // An encode the browser claimed but could not fetch or decode: try the next, else stay still.
  function onError() {
    const video = videoRef.current;
    const next = frameSources[sourceIndex.current + 1];
    if (!video || !next) {
      onDone();
      return;
    }
    sourceIndex.current += 1;
    video.src = next.src;
    video.play().catch(() => {});
  }

  const visible = shown && !ending;

  return (
    <>
      <video
        ref={videoRef}
        aria-hidden
        muted
        playsInline
        preload="auto"
        data-shown={visible ? '' : undefined}
        className={`absolute inset-0 size-full object-cover transition-opacity ease-out ${visible ? 'opacity-100 duration-1000' : 'opacity-0 duration-[1.4s]'}`}
        onPlaying={() => setShown(true)}
        onPlay={() => setPaused(false)}
        onPause={(event) => {
          // The end fires pause too; the control keeps its icon as it fades out.
          if (!event.currentTarget.ended) setPaused(true);
        }}
        onEnded={() => setEnding(true)}
        onError={onError}
        onTransitionEnd={(event) => {
          if (ending && event.propertyName === 'opacity') onDone();
        }}
      />
      {shown && (
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? 'Resume film' : 'Pause film'}
          className={`absolute top-3 right-3 z-20 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface/85 text-fg shadow-card backdrop-blur transition-[opacity,background-color] duration-500 hover:bg-surface starting:opacity-0 ${ending ? 'opacity-0' : ''}`}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}
    </>
  );
}
