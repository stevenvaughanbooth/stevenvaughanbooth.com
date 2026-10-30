import type { ReactNode } from 'react';
import { StepPanel, StepStack } from '../shared/step-panel';
import type { AutoAdvanceRegion } from '../shared/use-auto-advance';
import { VisualFrame } from '../shared/visual-frame';

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface TeamMultiplierContent {
  id: string;
  stages: readonly string[];
  /** Text alternative for the diagram at each stage. */
  descriptions: readonly string[];
  diagram: ReactNode;
  copy: readonly ReactNode[];
}

interface TeamMultiplierViewProps extends TeamMultiplierContent {
  step: number;
  /** The tablist: server-rendered and inert in the static card, live in the controller. */
  tabs: ReactNode;
  /** StepControls, likewise. */
  footer: ReactNode;
  region?: AutoAdvanceRegion;
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
        <StepPanel id={id} step={step} description={descriptions[step] ?? ''} diagram={diagram}>
          <StepStack step={step} items={copy} className="mt-5" />
        </StepPanel>
      </div>
    </VisualFrame>
  );
}
