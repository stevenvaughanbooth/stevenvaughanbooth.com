'use client';

import { lazy, type ReactNode, useRef } from 'react';
import { LazyVisual } from '@/components/visuals/shared/lazy-visual';
import type { FilmContent } from './film-view';

const load = () => import('./film-controller');
const Controller = lazy(() => load().then((module) => ({ default: module.FilmController })));

interface FilmShellProps extends FilmContent {
  /** The idle player, rendered on the server. */
  staticPlayer: ReactNode;
}

/**
 * The film's only code in the initial page. It shows the server-rendered idle player and loads
 * the controller as the film nears view. A press on Play before the controller arrives is kept,
 * and the film starts as soon as it can.
 */
export function FilmShell({ staticPlayer, ...content }: FilmShellProps) {
  const playRequested = useRef(false);
  return (
    <div
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('[data-play]')) {
          playRequested.current = true;
        }
      }}
    >
      <LazyVisual preload={load} fallback={staticPlayer}>
        <Controller {...content} playRequested={playRequested} />
      </LazyVisual>
    </div>
  );
}
