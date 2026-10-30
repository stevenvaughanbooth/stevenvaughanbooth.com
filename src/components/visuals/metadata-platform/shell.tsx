'use client';

import { lazy, type ReactNode } from 'react';
import { LazyVisual } from '../shared/lazy-visual';
import { type MetadataPlatformContent, MetadataPlatformView, phasesPerStory } from './view';

const load = () => import('./controller');
const Controller = lazy(() =>
  load().then((module) => ({ default: module.MetadataPlatformController })),
);

interface MetadataPlatformShellProps extends MetadataPlatformContent {
  staticControls: ReactNode;
  staticTabs: ReactNode;
  staticPhases: ReactNode;
}

/**
 * The visual's only code in the initial page. It lays out the server-rendered card, resting on
 * the last story's outcome, and loads the controller as the card nears view.
 */
export function MetadataPlatformShell({
  staticControls,
  staticTabs,
  staticPhases,
  ...content
}: MetadataPlatformShellProps) {
  return (
    <LazyVisual
      preload={load}
      fallback={
        <MetadataPlatformView
          {...content}
          step={content.stories.length * phasesPerStory - 1}
          announcement=""
          controls={staticControls}
          tabs={staticTabs}
          phaseSteps={staticPhases}
        />
      }
    >
      <Controller {...content} />
    </LazyVisual>
  );
}
