import { interactionDurations, recordInteraction } from './interactions';

/**
 * The live numbers in X-ray's HUD, measured in the visitor's own browser for this visit: the Core
 * Web Vitals from PerformanceObserver (buffered, so entries from before X-ray loaded count), and
 * what the page has downloaded from Resource Timing. The arithmetic follows the definitions
 * web.dev gives, without the web-vitals library: no new dependency for a handful of lines.
 */

export interface Vitals {
  /** Milliseconds from navigation start. */
  fcp?: number;
  lcp?: number;
  cls: number;
  /** Milliseconds; undefined until the first interaction. */
  inp?: number;
  /** Interactions so far: the browser's own count where it keeps one. */
  interactions: number;
}

export interface Shift {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
}

/**
 * Cumulative Layout Shift: the largest session window of shifts not caused by input, where a
 * window ends after a 1 s gap or once it spans 5 s.
 */
export function cumulativeLayoutShift(shifts: readonly Shift[]): number {
  let largest = 0;
  let current = 0;
  let first = 0;
  let last = 0;
  for (const shift of shifts) {
    if (shift.hadRecentInput) continue;
    if (current > 0 && shift.startTime - last < 1000 && shift.startTime - first < 5000) {
      current += shift.value;
    } else {
      current = shift.value;
      first = shift.startTime;
    }
    last = shift.startTime;
    largest = Math.max(largest, current);
  }
  return largest;
}

/**
 * Interaction to Next Paint: the slowest interaction, ignoring one for every 50 so a long visit
 * reports its 98th percentile, as web-vitals does. `count` is every interaction, the quick ones
 * no entry was kept for included. Undefined before any interaction.
 */
export function interactionToNextPaint(
  durations: Iterable<number>,
  count?: number,
): number | undefined {
  const sorted = [...durations].sort((a, b) => b - a);
  if (sorted.length === 0) return undefined;
  return sorted[Math.min(sorted.length - 1, Math.floor((count ?? sorted.length) / 50))];
}

export interface ResourceSummary {
  /** Every request Resource Timing saw before `since`, plus the document itself. */
  requests: number;
  scripts: number;
  /** Compressed bytes of JavaScript over the network: transferSize, which is 0 from the cache. */
  scriptBytes: number;
  /** Scripts served from the browser's cache, which transferred nothing. */
  cachedScripts: number;
  /** Cross-origin entries without Timing-Allow-Origin, which report 0 bytes whatever they cost. */
  opaque: number;
  /** Requests, and bytes of JavaScript, from `since` on: X-ray's own and whatever came after. */
  laterRequests: number;
  laterScriptBytes: number;
}

const isScript = (entry: PerformanceResourceTiming) =>
  entry.initiatorType === 'script' || new URL(entry.name).pathname.endsWith('.js');

/**
 * What the page downloaded, in two parts: the requests that started before `since` (when X-ray
 * was asked for), counted in full, and those from then on, which are X-ray's and anything later.
 */
export function summarizeResources(
  entries: readonly PerformanceResourceTiming[],
  origin: string,
  since = Infinity,
): ResourceSummary {
  const summary: ResourceSummary = {
    requests: 1,
    scripts: 0,
    scriptBytes: 0,
    cachedScripts: 0,
    opaque: 0,
    laterRequests: 0,
    laterScriptBytes: 0,
  };
  for (const entry of entries) {
    if (entry.startTime >= since) {
      summary.laterRequests += 1;
      if (isScript(entry)) summary.laterScriptBytes += entry.transferSize;
      continue;
    }
    summary.requests += 1;
    const sameOrigin = new URL(entry.name).origin === origin;
    const zero = entry.transferSize === 0;
    if (!sameOrigin && zero && entry.decodedBodySize === 0) summary.opaque += 1;
    if (!isScript(entry)) continue;
    summary.scripts += 1;
    summary.scriptBytes += entry.transferSize;
    if (zero && entry.decodedBodySize > 0) summary.cachedScripts += 1;
  }
  return summary;
}

export type Rating = 'good' | 'needs improvement' | 'poor';

/** web.dev's thresholds: good up to the first, poor beyond the second. */
const thresholds: Record<'fcp' | 'lcp' | 'cls' | 'inp', readonly [number, number]> = {
  fcp: [1800, 3000],
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  inp: [200, 500],
};

export function rate(metric: keyof typeof thresholds, value: number): Rating {
  const [good, poor] = thresholds[metric];
  if (value <= good) return 'good';
  return value <= poor ? 'needs improvement' : 'poor';
}

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
export const formatMilliseconds = (ms: number) => `${Math.round(ms)} ms`;
export const formatShift = (value: number) =>
  value === 0 ? '0' : value < 0.001 ? '< 0.001' : value.toFixed(3);
export const formatKilobytes = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
export const formatCount = (count: number) => count.toLocaleString('en-US');

/** Whether this browser reports a given entry type to PerformanceObserver. */
const supports = (type: string) =>
  globalThis.PerformanceObserver?.supportedEntryTypes?.includes(type) ?? false;

/**
 * Observes FCP, LCP, CLS and INP for this visit and calls `onChange` with each new reading. Every
 * observer is buffered, so it starts from the page's first entries; interactions come from the
 * recorder that started with the page (interactions.ts). Returns a function that stops them.
 */
export function observeVitals(onChange: (vitals: Vitals) => void): () => void {
  const vitals: Vitals = { cls: 0, interactions: 0 };
  const shifts: Shift[] = [];
  const observers: PerformanceObserver[] = [];
  const update = () => {
    vitals.cls = cumulativeLayoutShift(shifts);
    // Event Timing keeps entries only for interactions of 16 ms or more; Chrome counts them all.
    const counted = (performance as { interactionCount?: number }).interactionCount;
    vitals.interactions = Math.max(counted ?? 0, interactionDurations.size);
    vitals.inp = interactionToNextPaint(interactionDurations.values(), vitals.interactions);
    onChange({ ...vitals });
  };

  function observe(type: string, handle: (entries: PerformanceEntryList) => void, extra = {}) {
    if (!supports(type)) return;
    const observer = new PerformanceObserver((list) => {
      handle(list.getEntries());
      update();
    });
    observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    observers.push(observer);
  }

  observe('paint', (entries) => {
    const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) vitals.fcp = fcp.startTime;
  });
  // The browser stops reporting candidates at the first input, so the last one is the LCP.
  observe('largest-contentful-paint', (entries) => {
    const last = entries.at(-1);
    if (last) vitals.lcp = last.startTime;
  });
  observe('layout-shift', (entries) => {
    shifts.push(...(entries as unknown as Shift[]));
  });
  observe('event', (entries) => entries.forEach(recordInteraction), { durationThreshold: 16 });

  update();
  return () => observers.forEach((observer) => observer.disconnect());
}
