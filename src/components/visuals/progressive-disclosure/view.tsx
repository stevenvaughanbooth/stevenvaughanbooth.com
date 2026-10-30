import type { ReactNode } from 'react';
import { StepPanel, StepStack } from '../shared/step-panel';
import { VisualFrame } from '../shared/visual-frame';

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface ProgressiveDisclosureContent {
  id: string;
  steps: readonly string[];
  /** Text alternative for the graph at each step. */
  descriptions: readonly string[];
  /** Announced when the Next button changes the step (focus does not move to a tab then). */
  announcements: readonly string[];
  diagram: ReactNode;
  calls: readonly ReactNode[];
  copy: readonly ReactNode[];
}

interface ProgressiveDisclosureViewProps extends ProgressiveDisclosureContent {
  step: number;
  announcement: string;
  /** The tablist: server-rendered and inert in the static card, live in the controller. */
  tabs: ReactNode;
  /** StepControls, likewise. */
  footer: ReactNode;
}

/** The progressive-disclosure card's layout around the server-rendered graph and copy. */
export function ProgressiveDisclosureView({
  id,
  descriptions,
  diagram,
  calls,
  copy,
  step,
  announcement,
  tabs,
  footer,
}: ProgressiveDisclosureViewProps) {
  return (
    <VisualFrame id={id} title="Context on demand" accent="green" footer={footer}>
      {tabs}
      <StepPanel id={id} step={step} description={descriptions[step] ?? ''} diagram={diagram}>
        <StepStack
          step={step}
          items={calls}
          className="mt-4 rounded-xl border border-line bg-bg px-3.5 py-3 font-mono text-[0.78rem] leading-relaxed sm:px-4"
        />
        <StepStack step={step} items={copy} className="mt-5" />
      </StepPanel>
      <p className="sr-only" aria-live="polite" aria-atomic>
        {announcement}
      </p>
    </VisualFrame>
  );
}
