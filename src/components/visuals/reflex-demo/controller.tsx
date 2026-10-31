import { useInView, useReducedMotion } from '../shared/hooks';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { wording } from './controls';
import { Terminal } from './terminal';
import { beatsShown, buildFrames, finalFrame, type Step } from './timeline';
import { type ReflexDemoContent, ReflexDemoView } from './view';

/** Share of the terminal on screen before the replay starts by itself, and while it plays. */
const startAt = 0.4;

interface ReflexDemoControllerProps extends ReflexDemoContent {
  steps: readonly Step[];
}

/**
 * Loaded lazily by the shell: replays the session once as the card scrolls in, on the same tour
 * as the diagrams, with each frame of the replay a step. It starts on the finished session the
 * server rendered. If the card is already on screen when the controller loads, it stays there and
 * offers to play, so the visitor never sees text vanish; otherwise it resets out of sight and
 * plays when enough of the terminal is in view. It holds like every tour (off screen, hidden tab,
 * hover, focus, a press) and never animates under reduced motion.
 */
export function ReflexDemoController({ steps, ...content }: ReflexDemoControllerProps) {
  const reducedMotion = useReducedMotion();
  const frames = buildFrames(steps);
  const tour = useTour({
    steps: frames.length,
    dwellMs: (index) => frames[index + 1]?.delay ?? 0,
    threshold: startAt,
    start: 'unseen',
  });
  const onScreen = useInView(tour.region.ref);
  const playing = tour.playback === 'playing' && !reducedMotion;

  const frame = reducedMotion ? finalFrame(steps) : (frames[tour.step] ?? finalFrame(steps));
  const reflex = steps.findIndex((step) => step.kind === 'reflex');

  return (
    <ReflexDemoView
      {...content}
      matched={reflex >= 0 && beatsShown(frame, reflex) >= 1}
      looping={frame.step === steps.length}
      terminal={
        <div {...tour.region}>
          <Terminal
            steps={steps}
            frame={frame}
            live={!reducedMotion && (tour.playback === 'ready' || playing) && onScreen}
            flash={playing}
          />
        </div>
      }
      footer={
        <TourControls
          accent="green"
          playback={tour.playback}
          running={tour.running}
          wording={wording}
          onToggle={tour.toggle}
        />
      }
    />
  );
}
