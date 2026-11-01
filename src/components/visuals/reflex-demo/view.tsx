import type { ReactNode } from 'react';
import type { TourRegion } from '../shared/tour/use-tour';
import { VisualFrame } from '../shared/visual-frame';
import type { ReflexSceneData } from './scene-data';

/** The id of the pipeline's heading, which names its list. */
export const pipelineLabelId = (id: string) => `${id}-pipeline`;

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface ReflexDemoContent {
  id: string;
  /** The sr-only transcript: the replay for assistive technology, which never animates. */
  transcript: ReactNode;
  /** Adage's pipeline, drawn in 2D: the stage's content, and its fallback under the 3D scene. */
  pipeline: ReactNode;
  /** What the controller's 3D scene draws. */
  sceneData: ReflexSceneData;
}

interface ReflexDemoViewProps extends ReflexDemoContent {
  /** The terminal: server-rendered at its last frame in the static card, live in the controller. */
  terminal: ReactNode;
  /** StepControls, likewise. */
  footer: ReactNode;
  /** The reflex is showing: lights the pipeline's last step. */
  matched: boolean;
  /** The session is over: lights the loop back into later sessions. */
  looping: boolean;
  /** The stage and the terminal: what hover, focus and a press hold. */
  region?: TourRegion;
  /** The controller's 3D scene over the pipeline. */
  scene?: ReactNode;
}

/**
 * The replay card's layout: the pipeline's stage, where the 3D scene draws, above the terminal
 * the reflex fires into, then the transcript.
 */
export function ReflexDemoView({
  id,
  transcript,
  pipeline,
  terminal,
  footer,
  matched,
  looping,
  region,
  scene,
}: ReflexDemoViewProps) {
  return (
    <VisualFrame
      id={id}
      title="Session replay"
      accent="green"
      footer={footer}
      footerClassName="motion-reduce:hidden"
    >
      <div
        data-matched={matched || undefined}
        data-looping={looping || undefined}
        className="group/reflex"
      >
        <div {...region}>
          <p id={pipelineLabelId(id)} className="label">
            From history to reuse
          </p>
          <div className="relative mt-3 grid aspect-square place-items-center rounded-xl border border-line bg-bg bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:18px_18px] px-3 py-4 @md:aspect-[16/9] @md:px-4">
            {/* The scene comes first so the pipeline can follow its state as a sibling: a :has()
                selector would restart the evidence figures' count-up in Chromium. It is
                absolutely positioned, so it still draws above the pipeline. */}
            {scene}
            <div className="w-full transition-opacity duration-700 peer-data-[scene=live]:opacity-0 motion-reduce:transition-none">
              {pipeline}
            </div>
          </div>
          <div className="mt-4">{terminal}</div>
        </div>
        {transcript}
      </div>
    </VisualFrame>
  );
}
