/**
 * The longest duration of each interaction on this page so far, by interaction id, from the Event
 * Timing API. X-ray's HUD reports INP from it (metrics.ts).
 *
 * It starts with the page, not with X-ray: the browser buffers only events of 104 ms or more, so
 * an observer started later would miss the shorter interactions before it and could report an
 * INP lower than the visit's. `first-input` is observed too, because a first interaction quicker
 * than the 16 ms threshold is still the visit's only one.
 */
export const interactionDurations = new Map<number, number>();

/** Event Timing's interaction id, which TypeScript's DOM types don't have yet. 0 for a lone event. */
type EventEntry = PerformanceEntry & { interactionId?: number };

export function recordInteraction(entry: PerformanceEntry): void {
  const { interactionId } = entry as EventEntry;
  if (!interactionId) return;
  const longest = interactionDurations.get(interactionId) ?? 0;
  interactionDurations.set(interactionId, Math.max(longest, entry.duration));
}

let observing = false;

export function observeInteractions(): void {
  if (observing || !globalThis.PerformanceObserver?.supportedEntryTypes?.includes('event')) return;
  observing = true;
  const observer = new PerformanceObserver((list) => list.getEntries().forEach(recordInteraction));
  // durationThreshold is Event Timing's own option, also missing from TypeScript's types.
  observer.observe({
    type: 'event',
    buffered: true,
    durationThreshold: 16,
  } as PerformanceObserverInit);
  observer.observe({ type: 'first-input', buffered: true });
}
