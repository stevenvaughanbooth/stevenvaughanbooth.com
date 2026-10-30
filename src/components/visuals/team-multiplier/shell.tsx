'use client';

import { lazy, type ReactNode } from 'react';
import { LazyVisual } from '../shared/lazy-visual';
import { type TeamMultiplierContent, TeamMultiplierView } from './view';

const load = () => import('./controller');
const Controller = lazy(() =>
  load().then((module) => ({ default: module.TeamMultiplierController })),
);

interface TeamMultiplierShellProps extends TeamMultiplierContent {
  staticTabs: ReactNode;
  staticFooter: ReactNode;
}

/**
 * The visual's only code in the initial page. It lays out the server-rendered card, resting on
 * the complete loop, and loads the controller as the card nears view.
 */
export function TeamMultiplierShell({
  staticTabs,
  staticFooter,
  ...content
}: TeamMultiplierShellProps) {
  return (
    <LazyVisual
      preload={load}
      fallback={
        <TeamMultiplierView
          {...content}
          step={content.stages.length - 1}
          tabs={staticTabs}
          footer={staticFooter}
        />
      }
    >
      <Controller {...content} />
    </LazyVisual>
  );
}
