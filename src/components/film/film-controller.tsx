import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { useInView } from '@/components/visuals/shared/hooks';
import { type FilmContent, type FilmStatus, FilmView } from './film-view';
import { filmDuration, pickSource, sources } from './media';

const seekKeys: Record<string, (t: number, duration: number) => number> = {
  ArrowLeft: (t) => t - 1,
  ArrowDown: (t) => t - 1,
  ArrowRight: (t) => t + 1,
  ArrowUp: (t) => t + 1,
  PageDown: (t) => t - 5,
  PageUp: (t) => t + 5,
  Home: () => 0,
  End: (_, duration) => duration,
};

interface FilmControllerProps extends FilmContent {
  /** Set when Play was pressed on the static player, before this chunk arrived. */
  playRequested: RefObject<boolean>;
}

/**
 * Loaded lazily by the shell: the click-to-play film. The <video> has no source until Play, so
 * nothing downloads before the visitor asks; then it picks the best encode the browser supports
 * and falls back on error. It pauses while scrolled out of view and resumes on return.
 */
export function FilmController({ playRequested, ...content }: FilmControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sourceIndex = useRef(-1);
  const autoPaused = useRef(false);
  const [status, setStatus] = useState<FilmStatus>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(filmDuration);
  const [hasFrame, setHasFrame] = useState(false);

  useInView(cardRef, {
    onChange(inView) {
      const video = videoRef.current;
      if (!video) return;
      if (!inView && !video.paused) {
        autoPaused.current = true;
        video.pause();
      } else if (inView && autoPaused.current) {
        autoPaused.current = false;
        video.play().catch(() => {});
      }
    },
  });

  function load(video: HTMLVideoElement, index: number) {
    const source = sources[index];
    if (!source) return false;
    sourceIndex.current = index;
    video.src = source.src;
    return true;
  }

  function play() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    if (sourceIndex.current === -1 || status === 'error') {
      video.preload = 'auto';
      load(video, pickSource(video));
    }
    if (video.ended) video.currentTime = 0;
    autoPaused.current = false;
    setStatus(video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? 'playing' : 'loading');
    // Called inside the click so mobile browsers treat it as user-initiated. Rejections from an
    // interrupted play() are expected; real failures arrive as the element's error event.
    video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') setStatus('paused');
    });
  }

  // A press on the static player while this chunk loaded: honour it. The film is muted, so
  // browsers let it start without the original gesture.
  const playOnArrival = useEffectEvent(() => {
    if (playRequested.current) play();
  });
  useEffect(() => playOnArrival(), []);

  function toggle() {
    const video = videoRef.current;
    if (video && !video.paused) {
      autoPaused.current = false;
      video.pause();
    } else {
      play();
    }
  }

  function seek(to: number) {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(Math.max(to, 0), duration);
    video.currentTime = next;
    setTime(next);
    if (status === 'ended' && next < duration) setStatus('paused');
  }

  function onSeekKey(event: KeyboardEvent<HTMLInputElement>) {
    const step = seekKeys[event.key];
    if (!step) return;
    event.preventDefault();
    seek(step(time, duration));
  }

  // An encode the browser claimed but could not fetch or decode: fall back to the next one.
  function onError() {
    const video = videoRef.current;
    if (!video || sourceIndex.current === -1) return;
    const resumeAt = time;
    if (!load(video, sourceIndex.current + 1)) {
      setStatus('error');
      return;
    }
    video.currentTime = resumeAt;
    video.play().catch(() => {});
  }

  return (
    <FilmView
      {...content}
      status={status}
      time={time}
      duration={duration}
      hasFrame={hasFrame}
      controls={{
        cardRef,
        onToggle: toggle,
        onSeek: seek,
        onSeekKey,
        video: {
          ref: videoRef,
          onPlaying() {
            setHasFrame(true);
            setStatus('playing');
          },
          onWaiting(event) {
            if (!event.currentTarget.paused) setStatus('loading');
          },
          onPause(event) {
            // Chrome also fires pause after a load error and at the end; keep those states.
            const video = event.currentTarget;
            if (!video.ended && !video.error) setStatus('paused');
          },
          onEnded: () => setStatus('ended'),
          onTimeUpdate: (event) => setTime(event.currentTarget.currentTime),
          onDurationChange(event) {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          },
          onError,
        },
      }}
    />
  );
}
