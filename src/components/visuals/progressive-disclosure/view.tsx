import type { ReactNode } from 'react';
import { StepPanel, StepStack } from '../shared/step-panel';
import type { TourRegion } from '../shared/tour/use-tour';
import { VisualFrame } from '../shared/visual-frame';
import type { DisclosureSceneData } from './scene-data';

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface ProgressiveDisclosureContent {
  id: string;
  steps: readonly string[];
  /** Text alternative for the graph at each step. */
  descriptions: readonly string[];
  diagram: ReactNode;
  calls: readonly ReactNode[];
  copy: readonly ReactNode[];
  /** What the controller's 3D scene draws. */
  sceneData: DisclosureSceneData;
}

interface ProgressiveDisclosureViewProps extends ProgressiveDisclosureContent {
  step: number;
  /** The tablist: server-rendered and inert in the static card, live in the controller. */
  tabs: ReactNode;
  /** TourControls, likewise. */
  footer: ReactNode;
  region?: TourRegion;
  /** The controller's 3D scene over the graph. */
  scene?: ReactNode;
}

/** The progressive-disclosure card's layout around the server-rendered graph and copy. */
export function ProgressiveDisclosureView({
  id,
  descriptions,
  diagram,
  calls,
  copy,
  step,
  tabs,
  footer,
  region,
  scene,
}: ProgressiveDisclosureViewProps) {
  return (
    <VisualFrame
      id={id}
      title="Context on demand"
      accent="green"
      footer={footer}
      footerClassName="motion-reduce:hidden"
    >
      <div {...region}>
        {tabs}
        <StepPanel
          id={id}
          step={step}
          description={descriptions[step] ?? ''}
          diagram={diagram}
          scene={scene}
        >
          <StepStack
            step={step}
            items={calls}
            className="mt-4 rounded-xl border border-line bg-bg px-3.5 py-3 font-mono text-[0.78rem] leading-relaxed sm:px-4"
          />
          <StepStack step={step} items={copy} className="mt-5" />
        </StepPanel>
      </div>
    </VisualFrame>
  );
}
