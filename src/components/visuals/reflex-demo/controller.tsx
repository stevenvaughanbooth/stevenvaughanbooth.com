import { useEffect, useRef, useState } from 'react';
import { useInView, usePageVisible, useReducedMotion } from '../shared/hooks';
import { StepControls } from '../shared/step-controls';
import { type ReplayStatus, replayControls } from './controls';
import { Terminal } from './terminal';
import { beatsShown, buildFrames, finalFrame, type Step } from './timeline';
import { type ReflexDemoContent, ReflexDemoView } from './view';

/** Share of the terminal on screen before the replay starts by itself. */
const startAt = 0.4;

interface ReflexDemoControllerProps extends ReflexDemoContent {
  steps: readonly Step[];
}

/**
 * Loaded lazily by the shell: replays the session once as the card scrolls in. It starts on the
 * finished session the server rendered. If the card is already on screen when the controller
 * loads, it stays there and offers a replay, so the visitor never sees text vanish; otherwise it
 * resets out of sight and plays when enough of the terminal is in view. It counts down only while
 * the terminal is on screen and the tab is visible, and never animates under reduced motion.
 */
export function ReflexDemoController({ steps, ...content }: ReflexDemoControllerProps) {
  const terminal = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const frames = buildFrames(steps);
  const last = frames.length - 1;
  const [index, setIndex] = useState(last);
  const [status, setStatus] = useState<ReplayStatus>('idle');

  const onScreen = useInView(terminal, {
    onChange(inView) {
      if (status !== 'idle') return;
      if (inView || reducedMotion) {
        setStatus('done');
      } else {
        setIndex(0);
        setStatus('ready');
      }
    },
  });
  useInView(terminal, {
    threshold: startAt,
    onChange(inView) {
      if (inView && status === 'ready') setStatus('playing');
    },
  });

  const playing = status === 'playing' && !reducedMotion;
  const delay = frames[index + 1]?.delay;

  // One timer at a time, only while playing where someone can see it.
  useEffect(() => {
    if (!playing || !onScreen || !pageVisible || delay === undefined) return;
    const timer = window.setTimeout(() => {
      setIndex(index + 1);
      if (index + 1 === last) setStatus('done');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, onScreen, pageVisible, delay, index, last]);

  function control() {
    if (status === 'playing') {
      setIndex(last);
      setStatus('done');
    } else {
      setIndex(0);
      setStatus('playing');
    }
  }

  const frame = reducedMotion ? finalFrame(steps) : (frames[index] ?? finalFrame(steps));
  const reflex = steps.findIndex((step) => step.kind === 'reflex');
  const { status: text, action } = replayControls(status);

  return (
    <ReflexDemoView
      {...content}
      matched={reflex >= 0 && beatsShown(frame, reflex) >= 1}
      looping={frame.step === steps.length}
      terminal={
        <Terminal
          ref={terminal}
          steps={steps}
          frame={frame}
          live={!reducedMotion && (status === 'ready' || playing) && onScreen}
          flash={playing}
        />
      }
      footer={
        <StepControls
          status={text}
          accent="green"
          live={playing && onScreen && pageVisible}
          action={{ ...action, onClick: control }}
        />
      }
    />
  );
}
