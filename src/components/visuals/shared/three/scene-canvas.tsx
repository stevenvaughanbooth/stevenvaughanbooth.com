import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useInView, useReducedMotion } from '../hooks';
import type { SceneHandle, SceneModule } from './engine';
import { sceneOptOut, whenStill } from './support';

interface SceneCanvasProps<Data> {
  /** Imports the diagram's scene module, the chunk that brings three.js. */
  load: () => Promise<{ scene: SceneModule<Data> }>;
  /** What the scene draws, from the server: labels and counts, never markup. */
  data: Data;
  step: number;
  /**
   * Whether the tour is counting down to its next step. A scene that is ready while it does
   * waits for that step to begin before it swaps in, so it never replaces the diagram mid-step.
   */
  running?: boolean;
  /**
   * Called once the 3D question is settled: true when the scene has swapped in, false when it
   * will not (the device opts out, the chunk or WebGL fails). The tour holds until then.
   */
  onSettle?: (live: boolean) => void;
}

/**
 * A diagram's 3D scene, laid over its server-rendered SVG inside the step panel's stage. It
 * imports nothing from three.js itself: once the page has loaded, gone idle and stopped scrolling,
 * and only if the device can and may draw in 3D (see support.ts), it imports the scene's chunk
 * and mounts it, at the step on show. Its box covers the stage and stays transparent until the
 * scene has drawn and the swap would interrupt nothing: at once if the stage is out of sight or the
 * tour is not counting down, otherwise as the next step begins. Then it takes
 * `data-scene="live"`: the SVG after it (it is their `peer`) fades out quickly, and only then does
 * the scene fade in, so the two diagrams are never seen through each other. If the chunk fails,
 * WebGL fails or the context is lost, it stays transparent and the 2D diagram shows. It is
 * aria-hidden: the stage's text alternative and the card's copy carry the content.
 */
export function SceneCanvas<Data>({
  load,
  data,
  step,
  running = false,
  onSettle,
}: SceneCanvasProps<Data>) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const onScreen = useInView(ref);
  // Whether the engine has a frame drawn (false again while a lost context is restored).
  const [drawn, setDrawn] = useState(false);
  // The step on show when the scene first drew: a different one now is a step boundary.
  const [drawnAt, setDrawnAt] = useState<number | null>(null);
  const [swapped, setSwapped] = useState(false);
  // Once swapped in it stays: a restored context comes straight back.
  if (!swapped && drawnAt !== null && (!onScreen || !running || step !== drawnAt)) {
    setSwapped(true);
  }
  const live = drawn && swapped;

  // The step and motion setting as they are when the scene arrives, which may be after a change.
  const current = useEffectEvent(() => ({ step, reducedMotion }));
  const sync = useEffectEvent((scene: SceneHandle) => {
    scene.setReducedMotion(reducedMotion);
    scene.setStep(step);
  });
  const settle = useEffectEvent((on: boolean) => onSettle?.(on));
  const firstDraw = useEffectEvent(() => setDrawnAt((at) => at ?? step));

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    if (sceneOptOut()) {
      settle(false);
      return;
    }
    let cancelled = false;
    const cancelWait = whenStill(() => {
      load()
        .then(({ scene }) =>
          cancelled
            ? null
            : scene.mount(container, {
                data,
                ...current(),
                onLive(on) {
                  if (cancelled) return;
                  setDrawn(on);
                  if (on) firstDraw();
                },
              }),
        )
        .then((scene) => {
          if (!scene) return;
          if (cancelled) {
            scene.dispose();
            return;
          }
          handle.current = scene;
          sync(scene);
        })
        .catch(() => {
          // The chunk or WebGL failed: the 2D diagram stays.
          if (!cancelled) settle(false);
        });
    });
    return () => {
      cancelled = true;
      cancelWait();
      handle.current?.dispose();
      handle.current = null;
    };
  }, [load, data]);

  useEffect(() => {
    if (live) settle(true);
  }, [live]);

  useEffect(() => {
    handle.current?.setStep(step);
  }, [step]);

  useEffect(() => {
    handle.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      aria-hidden
      data-scene={live ? 'live' : undefined}
      className="peer pointer-events-none absolute inset-0 overflow-hidden rounded-[11px] opacity-0 transition-opacity duration-300 data-[scene=live]:pointer-events-auto data-[scene=live]:opacity-100 data-[scene=live]:delay-150 motion-reduce:transition-none"
    />
  );
}
