import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
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

/**
 * Loaded on intent by the hero's shell: the theater's player, which mounts as the theater opens.
 * If it throws, the theater keeps its notes and shows `fallback` instead, and the page stays up.
 */
export function Theater({ fallback, ...content }: FilmContent & { fallback: ReactNode }) {
  return (
    <KeepOnError fallback={fallback}>
      <FilmController {...content} />
    </KeepOnError>
  );
}

class KeepOnError extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Plays the full film from the start, picking the best encode the browser supports and falling
 * back on error. The theater is modal, so the film is never scrolled out of view.
 */
function FilmController(content: FilmContent) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceIndex = useRef(-1);
  const [status, setStatus] = useState<FilmStatus>('idle');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(filmDuration);
  const [hasFrame, setHasFrame] = useState(false);

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
    setStatus(video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? 'playing' : 'loading');
    // Rejections from an interrupted play() are expected; real failures arrive as the element's
    // error event.
    video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') setStatus('paused');
    });
  }

  // Opening the theater is the request to play. The film is muted, so browsers let it start
  // even though the press that opened the theater has passed.
  const playOnOpen = useEffectEvent(play);
  useEffect(() => playOnOpen(), []);

  function toggle() {
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
    else play();
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
