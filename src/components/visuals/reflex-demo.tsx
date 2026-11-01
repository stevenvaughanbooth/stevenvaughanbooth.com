import { adage } from '@/content/profile';
import { TourControls } from './shared/tour/tour-controls';
import { wording } from './reflex-demo/controls';
import { Pipeline } from './reflex-demo/pipeline';
import { reflexSceneData } from './reflex-demo/scene-data';
import { steps, transcript } from './reflex-demo/script';
import { ReflexDemoShell } from './reflex-demo/shell';
import { Terminal } from './reflex-demo/terminal';
import { finalFrame } from './reflex-demo/timeline';

const id = 'reflex-demo';

/**
 * An illustrative replay of the Adage README's worked example: a test command that bypasses the
 * repository's setup fails twice, a reflex supplies the command the history shows works, and the
 * agent runs it. The server renders the finished session and Adage's pipeline; a controller,
 * loaded as the card nears view, replays it once on the tour every diagram shares and, where the
 * device can draw it, stages the pipeline in 3D above the terminal. The terminal and the scene
 * are hidden from assistive technology, which gets the same story as a transcript and the
 * pipeline as a list.
 *
 * The terminal reaches the client twice, as the static render and as the script the controller
 * types out. That costs a little HTML and keeps the terminal's markup out of the initial bundle.
 */
export function ReflexDemo() {
  return (
    // The card is drawn by the client shell; this server-rendered root is what X-ray labels.
    <div data-component="reflex-demo" className="min-w-0">
      <ReflexDemoShell
        id={id}
        steps={steps}
        staticTerminal={<Terminal steps={steps} frame={finalFrame(steps)} />}
        staticFooter={
          <TourControls accent="green" playback="idle" running={false} wording={wording} />
        }
        transcript={
          <div className="sr-only">
            <p>Transcript of the illustrative replay, based on the worked example in the README.</p>
            <ol>
              {transcript(steps).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        }
        pipeline={<Pipeline id={id} stages={adage.pipeline} />}
        sceneData={reflexSceneData()}
      />
    </div>
  );
}
