import type { ReactNode } from 'react';
import { panelId, tabId } from './ids';

interface StepPanelProps {
  id: string;
  step: number;
  /** Text alternative for the diagram at this step. */
  description: string;
  /** The server-rendered SVG. It reads the step from the `data-step` attribute on its frame. */
  diagram: ReactNode;
  /** Step-specific copy below the diagram, usually StepStacks. */
  children?: ReactNode;
}

/**
 * The tabpanel of a stepped visual: the diagram stage, then the step's copy. The stage carries
 * `data-step`, so the server-rendered diagram changes state through CSS alone.
 */
export function StepPanel({ id, step, description, diagram, children }: StepPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(id)}
      aria-labelledby={tabId(id, step)}
      tabIndex={0}
      className="mt-4 rounded-xl"
    >
      <div
        role="img"
        aria-label={description}
        data-step={step}
        className="rounded-xl border border-line bg-bg bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:18px_18px] px-1 py-4 @sm:px-4 @sm:py-5"
      >
        {diagram}
      </div>
      {children}
    </div>
  );
}

interface StepStackProps {
  step: number;
  items: readonly ReactNode[];
  className?: string;
}

/**
 * Every step's content in one grid cell, only the current one visible: the stack is as tall as
 * its tallest item, so changing steps never moves the page.
 */
export function StepStack({ step, items, className = '' }: StepStackProps) {
  return (
    <div className={`grid ${className}`}>
      {items.map((item, index) => (
        <div
          key={index}
          className={`col-start-1 row-start-1 transition-opacity duration-300 ${index === step ? 'opacity-100' : 'invisible opacity-0'}`}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

/** A step's heading and explanation, as every stepped visual sets them below its diagram. */
export function StepCopy({ title, body }: { title: string; body: string }) {
  return (
    <>
      <p className="font-semibold tracking-tight text-pretty text-fg">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{body}</p>
    </>
  );
}
