import { useLayoutEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from '../shared/hooks';
import { SceneCanvas } from '../shared/three/scene-canvas';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { wording } from './controls';
import { sceneBeat } from './scene-beats';
import { Terminal } from './terminal';
import { beatsShown, buildFrames, finalFrame, type Step } from './timeline';
import { type ReflexDemoContent, ReflexDemoView } from './view';

/** The 3D scene's chunk, with three.js. SceneCanvas imports it once the page has settled. */
const loadScene = () => import('./scene');

/**
 * Share of the stage and terminal on screen before the replay starts by itself, and while it
 * plays. Both fit on one screen at every width, and either one alone is more than this.
 */
const startAt = 0.4;

interface ReflexDemoControllerProps extends ReflexDemoContent {
  steps: readonly Step[];
}

/**
 * Loaded lazily by the shell: replays the session once as the card scrolls in, on the same tour
 * as the diagrams, with each frame of the replay a step. It starts on the finished session the
 * server rendered. Out of sight as the controller loads, it resets there and plays when enough of
 * the card is in view; already on screen (a jump to the section), the finished session stays for
 * a beat once the visitor has arrived, then the replay starts from the top, as every tour does.
 * It holds like every tour (off screen, hidden tab,
 * hover, focus, a press) and never animates under reduced motion. Where the device can draw it,
 * a 3D scene over the pipeline follows the replay: the history the reflex was learned from, the
 * reflex taking shape, and the reflex firing into the session as the terminal offers it.
 */
export function ReflexDemoController({ steps, ...content }: ReflexDemoControllerProps) {
  const reducedMotion = useReducedMotion();
  const frames = buildFrames(steps);
  // The replay waits for the 3D scene to swap in (or not), so it never swaps in mid-beat.
  const [settled, setSettled] = useState(false);
  const tour = useTour({
    steps: frames.length,
    dwellMs: (index) => frames[index + 1]?.delay ?? 0,
    threshold: startAt,
    hold: !settled,
  });
  const onScreen = useInView(tour.region.ref);
  const playing = tour.playback === 'playing' && !reducedMotion;

  const frame = reducedMotion ? finalFrame(steps) : (frames[tour.step] ?? finalFrame(steps));
  const reflex = steps.findIndex((step) => step.kind === 'reflex');

  // The console follows the newest line, as a terminal does: scrolling, never moving the page.
  const consoleBox = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = consoleBox.current;
    if (!element) return;
    const top = element.scrollHeight;
    if (playing && typeof element.scrollTo === 'function')
      element.scrollTo({ top, behavior: 'smooth' });
    else element.scrollTop = top;
  }, [frame.step, frame.beat, playing]);

  return (
    <ReflexDemoView
      {...content}
      matched={reflex >= 0 && beatsShown(frame, reflex) >= 1}
      looping={frame.step === steps.length}
      region={tour.region}
      consoleRef={consoleBox}
      terminal={
        <Terminal
          steps={steps}
          frame={frame}
          live={!reducedMotion && (tour.playback === 'ready' || playing) && onScreen}
          flash={playing}
        />
      }
      scene={
        <SceneCanvas
          load={loadScene}
          data={content.sceneData}
          step={sceneBeat(steps, frame)}
          running={tour.running}
          onSettle={() => setSettled(true)}
        />
      }
      footer={
        <TourControls
          accent="green"
          playback={tour.playback}
          running={tour.running}
          looking={tour.looking}
          wording={wording}
          onToggle={tour.toggle}
        />
      }
    />
  );
}
