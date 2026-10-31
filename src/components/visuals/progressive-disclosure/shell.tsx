'use client';

import { lazy, type ReactNode } from 'react';
import { LazyVisual } from '../shared/lazy-visual';
import { type ProgressiveDisclosureContent, ProgressiveDisclosureView } from './view';

const load = () => import('./controller');
const Controller = lazy(() =>
  load().then((module) => ({ default: module.ProgressiveDisclosureController })),
);

interface ProgressiveDisclosureShellProps extends ProgressiveDisclosureContent {
  staticTabs: ReactNode;
  staticFooter: ReactNode;
}

/**
 * The visual's only code in the initial page. It lays out the server-rendered card, resting on
 * the opened record, and loads the controller as the card nears view.
 */
export function ProgressiveDisclosureShell({
  staticTabs,
  staticFooter,
  ...content
}: ProgressiveDisclosureShellProps) {
  return (
    <LazyVisual
      preload={load}
      fallback={
        <ProgressiveDisclosureView
          {...content}
          step={content.steps.length - 1}
          tabs={staticTabs}
          footer={staticFooter}
        />
      }
    >
      <Controller {...content} />
    </LazyVisual>
  );
}
