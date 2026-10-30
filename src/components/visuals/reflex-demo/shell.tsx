'use client';

import { lazy, type ReactNode } from 'react';
import { LazyVisual } from '../shared/lazy-visual';
import type { Step } from './timeline';
import { type ReflexDemoContent, ReflexDemoView } from './view';

const load = () => import('./controller');
const Controller = lazy(() => load().then((module) => ({ default: module.ReflexDemoController })));

interface ReflexDemoShellProps extends ReflexDemoContent {
  /** The script the controller replays. */
  steps: readonly Step[];
  staticTerminal: ReactNode;
  staticFooter: ReactNode;
}

/**
 * The replay's only code in the initial page. It lays out the server-rendered card, resting on
 * the finished session, and loads the controller as the card nears view.
 */
export function ReflexDemoShell({
  steps,
  staticTerminal,
  staticFooter,
  ...content
}: ReflexDemoShellProps) {
  return (
    <LazyVisual
      preload={load}
      fallback={
        <ReflexDemoView
          {...content}
          terminal={staticTerminal}
          footer={staticFooter}
          matched
          looping
        />
      }
    >
      <Controller {...content} steps={steps} />
    </LazyVisual>
  );
}
