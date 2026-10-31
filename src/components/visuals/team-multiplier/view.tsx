import type { ReactNode } from 'react';
import { StepPanel, StepStack } from '../shared/step-panel';
import type { TourRegion } from '../shared/tour/use-tour';
import { VisualFrame } from '../shared/visual-frame';
import type { MultiplierSceneData } from './scene-data';

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface TeamMultiplierContent {
  id: string;
  stages: readonly string[];
  /** Text alternative for the diagram at each stage. */
  descriptions: readonly string[];
  diagram: ReactNode;
  copy: readonly ReactNode[];
  /** What the controller's 3D scene draws. */
  sceneData: MultiplierSceneData;
}

interface TeamMultiplierViewProps extends TeamMultiplierContent {
  step: number;
  /** The tablist: server-rendered and inert in the static card, live in the controller. */
  tabs: ReactNode;
  /** StepControls, likewise. */
  footer: ReactNode;
  region?: TourRegion;
  /** The controller's 3D scene over the network. */
  scene?: ReactNode;
}

/** The multiplier card's layout around the server-rendered diagram and copy. */
export function TeamMultiplierView({
  id,
  descriptions,
  diagram,
  copy,
  step,
  tabs,
  footer,
  region,
  scene,
}: TeamMultiplierViewProps) {
  return (
    <VisualFrame
      id={id}
      title="Multiplier effect"
      accent="amber"
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
          <StepStack step={step} items={copy} className="mt-5" />
        </StepPanel>
      </div>
    </VisualFrame>
  );
}
