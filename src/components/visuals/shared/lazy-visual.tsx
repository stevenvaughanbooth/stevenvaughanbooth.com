import {
  Component,
  type ReactNode,
  type RefObject,
  startTransition,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useInView } from './hooks';

/** How far outside the viewport a visual starts loading its controller. */
const PRELOAD_MARGIN = '200px 0px';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

function focusables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

interface LazyVisualProps {
  /** The static render: shown until the controller is ready, and kept if it fails. */
  fallback: ReactNode;
  /** Downloads the controller's chunk: the same import() its React.lazy wraps. */
  preload: () => Promise<unknown>;
  /** The controller, a React.lazy component, with its props. */
  children: ReactNode;
}

/**
 * Shows the static render, then swaps in the interactive controller once the visual is within
 * 200px of the viewport, or as soon as something in it takes focus or a pointer. The chunk is
 * downloaded first and the swap runs in a transition, so the static render is replaced once,
 * by the controller, and focus stays where it was. If the chunk fails to load or the controller
 * throws, the static render stays.
 *
 * There is deliberately no Suspense boundary until the chunk is ready: on the server one would
 * let the prerender stream the static render out of order, writing it into the HTML twice.
 */
export function LazyVisual({ fallback, preload, children }: LazyVisualProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const requested = useRef(false);
  // Which focusable element in the static render had focus, to restore it after the swap.
  const focusIndex = useRef(-1);

  function request() {
    if (requested.current) return;
    requested.current = true;
    preload().then(
      () => startTransition(() => setReady(true)),
      () => {
        // Keep the static render; the next focus or pointer inside tries again.
        requested.current = false;
      },
    );
  }

  useInView(ref, {
    rootMargin: PRELOAD_MARGIN,
    once: true,
    onChange(near) {
      if (near) request();
    },
  });

  return (
    <div
      ref={ref}
      className="min-w-0"
      onFocus={(event) => {
        focusIndex.current = focusables(event.currentTarget).indexOf(event.target);
        request();
      }}
      onBlur={(event) => {
        // A null relatedTarget can be the swap itself removing the focused element.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          focusIndex.current = -1;
        }
      }}
      onPointerDown={request}
    >
      {ready ? (
        <KeepStaticOnError fallback={fallback}>
          <Suspense fallback={fallback}>
            {children}
            <RestoreFocus container={ref} index={focusIndex} />
          </Suspense>
        </KeepStaticOnError>
      ) : (
        fallback
      )}
    </div>
  );
}

/** Mounts with the controller and puts focus back where it was in the static render. */
function RestoreFocus({
  container,
  index,
}: {
  container: RefObject<HTMLDivElement | null>;
  index: RefObject<number>;
}) {
  useLayoutEffect(() => {
    const root = container.current;
    const active = document.activeElement;
    if (!root || index.current < 0 || (active && active !== document.body)) return;
    focusables(root)[index.current]?.focus({ preventScroll: true });
  }, [container, index]);
  return null;
}

class KeepStaticOnError extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
