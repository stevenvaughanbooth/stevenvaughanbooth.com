import type { ReactNode } from 'react';
import { VisualFrame } from '../shared/visual-frame';

/** Rendered once on the server and passed once: the static card and the controller share it. */
export interface ReflexDemoContent {
  id: string;
  /** The sr-only transcript: the replay for assistive technology, which never animates. */
  transcript: ReactNode;
  pipeline: ReactNode;
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
}

/** The replay card's layout around the terminal, transcript and pipeline. */
export function ReflexDemoView({
  id,
  transcript,
  pipeline,
  terminal,
  footer,
  matched,
  looping,
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
        {terminal}
        {transcript}
        {pipeline}
      </div>
    </VisualFrame>
  );
}
