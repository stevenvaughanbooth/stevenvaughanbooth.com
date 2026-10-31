import { adage } from '@/content/profile';
import { StepControls } from './shared/step-controls';
import { replayControls } from './reflex-demo/controls';
import { Pipeline } from './reflex-demo/pipeline';
import { steps, transcript } from './reflex-demo/script';
import { ReflexDemoShell } from './reflex-demo/shell';
import { Terminal } from './reflex-demo/terminal';
import { finalFrame } from './reflex-demo/timeline';

const id = 'reflex-demo';

/**
 * An illustrative replay of the Adage README's worked example: a test command that bypasses the
 * repository's setup fails twice, a reflex supplies the command the history shows works, and the
 * agent runs it. The server renders the finished session; a controller, loaded as the card nears
 * view, replays it once. The terminal is hidden from assistive technology, which gets the same
 * story as a transcript.
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
        staticFooter={<StepControls accent="green" live={false} {...replayControls('idle')} />}
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
      />
    </div>
  );
}
