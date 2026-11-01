import type { ReactNode, Ref } from 'react';
import type { TourRegion } from '../shared/tour/use-tour';
import { VisualFrame } from '../shared/visual-frame';
import consoleStyles from './console.module.css';
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
  /** The terminal's lines: server-rendered at the last frame in the static card, live in the controller. */
  terminal: ReactNode;
  /** StepControls, likewise. */
  footer: ReactNode;
  /** The reflex is showing: lights the pipeline's last step. */
  matched: boolean;
  /** The session is over: lights the loop back into later sessions. */
  looping: boolean;
  /** The stage and the terminal: what hover, focus and a press hold, and what must be in view. */
  region?: TourRegion;
  /** The controller's 3D scene over the pipeline. */
  scene?: ReactNode;
  /**
   * The console the controller scrolls to the newest line as the replay plays. Without it (the
   * static card) the console rests scrolled to its end in CSS alone.
   */
  consoleRef?: Ref<HTMLDivElement>;
}

/**
 * The replay card's layout: the pipeline's stage, where the 3D scene draws, beside the terminal
 * the reflex fires into on a wide card, above it on a narrow one. Both keep a fixed height, so the
 * whole card fits on one screen while it plays. The terminal is a console that scrolls; the
 * transcript inside it is what assistive technology reads.
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
  consoleRef,
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
        <div
          {...region}
          className="grid grid-cols-1 gap-3 @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @3xl:grid-rows-[auto_26rem] @3xl:gap-x-4"
        >
          <p id={pipelineLabelId(id)} className="label">
            From history to reuse
          </p>
          <div className="relative grid aspect-[4/3] place-items-center rounded-xl border border-line bg-bg bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:18px_18px] px-3 py-4 @md:aspect-[2/1] @md:px-4 @3xl:col-start-1 @3xl:row-start-2 @3xl:aspect-auto">
            {/* The scene comes first so the pipeline can follow its state as a sibling: a :has()
                selector would restart the evidence figures' count-up in Chromium. It is
                absolutely positioned, so it still draws above the pipeline; the faded pipeline
                lets drags through to it. */}
            {scene}
            <div className="w-full transition-opacity duration-150 peer-data-[scene=live]:pointer-events-none peer-data-[scene=live]:opacity-0 motion-reduce:transition-none">
              {pipeline}
            </div>
          </div>
          {/* The fade follows the controller's console as it scrolls. The static console is a
              reversed column, whose scroll starts at its end, so there the fade simply stays. */}
          <div
            className={`${consoleRef ? consoleStyles.frame : ''} relative @3xl:col-start-2 @3xl:row-start-2`}
          >
            {/* Focusable, so keyboard users can scroll back through the session. */}
            <div
              ref={consoleRef}
              role="region"
              aria-label="Terminal"
              tabIndex={0}
              className={`${consoleRef ? consoleStyles.scroller : ''} relative h-72 overflow-y-auto rounded-xl border border-line bg-bg p-3.5 @md:h-64 @md:p-4 @3xl:h-full ${consoleRef ? '' : 'flex flex-col-reverse'}`}
            >
              {/* Without script, a reversed column rests on the end of the session. */}
              <div className={consoleRef ? '' : 'mb-auto'}>
                {terminal}
                {transcript}
              </div>
            </div>
            {/* The console's top edge: lines scrolled past fade out under it, rather than being cut
                mid-glyph, which also says there is more of the session above. */}
            <div
              aria-hidden
              className={`${consoleStyles.fade} pointer-events-none absolute inset-x-px top-px h-6 rounded-t-[11px]`}
            />
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}
