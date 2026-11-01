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
  /**
   * The controller's 3D scene (SceneCanvas), laid over the diagram. As it goes live the diagram
   * beneath fades out quickly, before the scene fades in, and keeps its place, so the stage never
   * changes size.
   */
  scene?: ReactNode;
}

/**
 * The tabpanel of a stepped visual: the diagram stage, then the step's copy. The stage carries
 * `data-step`, so the server-rendered diagram changes state through CSS alone.
 */
export function StepPanel({ id, step, description, diagram, children, scene }: StepPanelProps) {
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
        className="relative rounded-xl border border-line bg-bg bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:18px_18px] px-1 py-4 @sm:px-4 @sm:py-5"
      >
        {/* The scene comes first so the diagram can follow its state as a sibling: a :has()
            selector here would restart the page's scroll-triggered count-up in Chromium. It is
            absolutely positioned, so it still draws above the diagram; but the faded diagram's
            opacity puts it above the scene for the pointer, so it lets drags through. */}
        {scene}
        <div className="transition-opacity duration-150 peer-data-[scene=live]:pointer-events-none peer-data-[scene=live]:opacity-0 motion-reduce:transition-none">
          {diagram}
        </div>
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
    // One column that may shrink below its content: a hidden step's unbreakable line must not
    // widen the card (WCAG text spacing at 320px).
    <div className={`grid grid-cols-[minmax(0,1fr)] ${className}`}>
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
