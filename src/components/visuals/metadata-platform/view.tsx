import type { ReactNode } from 'react';
import { StepPanel, StepStack } from '../shared/step-panel';
import type { TourRegion } from '../shared/tour/use-tour';
import { VisualFrame } from '../shared/visual-frame';
import type { PlatformSceneData } from './scene-data';

/** Every story moves through three phases; the tour steps through them all, story by story. */
export const phasesPerStory = 3;

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface MetadataPlatformContent {
  id: string;
  /** Tab labels, one per story. */
  stories: readonly string[];
  /** Each story's phase labels. */
  phases: readonly (readonly string[])[];
  /** Text alternative for each story's diagram. */
  descriptions: readonly string[];
  /** Announced when a phase is picked, per step (story × phase): focus stays on the phase. */
  announcements: readonly string[];
  /** Each story's diagram. Only the current one is in the document. */
  scenes: readonly ReactNode[];
  titles: readonly ReactNode[];
  /** Per step. */
  narration: readonly ReactNode[];
  /** Per story. */
  contributions: readonly ReactNode[];
  /** What the controller's 3D scene draws. */
  sceneData: PlatformSceneData;
}

interface MetadataPlatformViewProps extends MetadataPlatformContent {
  /** Story × phase, from 0 to stories × phasesPerStory − 1. */
  step: number;
  announcement: string;
  /** TourControls, in the footer: server-rendered and inert in the static card, live in the controller. */
  controls: ReactNode;
  /** The tablist, likewise. */
  tabs: ReactNode;
  /** PhaseSteps, likewise. */
  phaseSteps: ReactNode;
  region?: TourRegion;
  /**
   * The controller's 3D scene over the diagrams. It follows every step (story × phase) and sits
   * outside the per-story diagram, so changing stories moves its camera instead of remounting it.
   */
  scene?: ReactNode;
}

/**
 * The platform card's layout around the server-rendered scenes and copy. The tour's control sits
 * in the footer, where every diagram keeps it.
 */
export function MetadataPlatformView({
  id,
  descriptions,
  scenes,
  titles,
  narration,
  contributions,
  step,
  announcement,
  controls,
  tabs,
  phaseSteps,
  region,
  scene,
}: MetadataPlatformViewProps) {
  const story = Math.floor(step / phasesPerStory);
  const phase = step % phasesPerStory;
  return (
    <VisualFrame
      id={id}
      title="Inside the platform"
      accent="lilac"
      footer={controls}
      footerClassName="motion-reduce:hidden"
    >
      <div {...region}>
        {tabs}
        <StepPanel
          id={id}
          step={story}
          description={descriptions[story] ?? ''}
          diagram={
            <div key={story} data-phase={phase}>
              {scenes[story]}
            </div>
          }
          scene={scene}
        >
          {phaseSteps}
          <StepStack step={story} items={titles} className="mt-3" />
          <StepStack step={step} items={narration} className="mt-1" />
          <StepStack step={story} items={contributions} className="mt-4" />
        </StepPanel>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic>
        {announcement}
      </p>
    </VisualFrame>
  );
}
