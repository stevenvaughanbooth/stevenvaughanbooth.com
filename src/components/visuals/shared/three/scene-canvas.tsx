import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks';
import type { SceneHandle, SceneModule } from './engine';
import { sceneOptOut, whenStill } from './support';

interface SceneCanvasProps<Data> {
  /** Imports the diagram's scene module, the chunk that brings three.js. */
  load: () => Promise<{ scene: SceneModule<Data> }>;
  /** What the scene draws, from the server: labels and counts, never markup. */
  data: Data;
  step: number;
}

/**
 * A diagram's 3D scene, laid over its server-rendered SVG inside the step panel's stage. It
 * imports nothing from three.js itself: once the page has loaded, gone idle and stopped scrolling,
 * and only if the device can and may draw in 3D (see support.ts), it imports the scene's chunk
 * and mounts it. Its box covers the stage and stays transparent until the first frame is drawn;
 * then it takes `data-scene="live"` and fades in, and the SVG after it (it is their `peer`) fades
 * out. If the chunk fails, WebGL fails or the context is lost, it stays transparent and the 2D
 * diagram shows. It is aria-hidden: the stage's text alternative and the card's copy carry the
 * content.
 */
export function SceneCanvas<Data>({ load, data, step }: SceneCanvasProps<Data>) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const [live, setLive] = useState(false);

  // The step and motion setting as they are when the scene arrives, which may be after a change.
  const current = useEffectEvent(() => ({ step, reducedMotion }));
  const sync = useEffectEvent((scene: SceneHandle) => {
    scene.setReducedMotion(reducedMotion);
    scene.setStep(step);
  });

  useEffect(() => {
    const container = ref.current;
    if (!container || sceneOptOut()) return;
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
                  if (!cancelled) setLive(on);
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
      className="peer pointer-events-none absolute inset-0 overflow-hidden rounded-[11px] opacity-0 transition-opacity duration-700 data-[scene=live]:pointer-events-auto data-[scene=live]:opacity-100 motion-reduce:transition-none"
    />
  );
}
