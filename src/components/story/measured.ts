/**
 * The site's measured results: the one place to update after re-measuring. The story's results
 * and the colophon's "Last measured" tiles both read from here, so they always agree.
 *
 * Lighthouse figures come from `lhci collect` and `lhci assert` with this repository's
 * lighthouserc.json against a local production build. Test counts are what Vitest and Playwright
 * report for a full run. Playwright counts each project, desktop and Pixel 7, separately, and
 * reports the tests a project skips apart from the ones that ran.
 */

export interface PageMeasurement {
  /** One of the pages lighthouserc.json audits, in its order. */
  path: '/' | '/colophon' | '/work/mcp';
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  /** Seconds. */
  fcp: number;
  /** Seconds. */
  lcp: number;
  /** Milliseconds. */
  tbt: number;
  cls: number;
  /** Compressed JavaScript transfer, in bytes. */
  script: number;
}

export const measured = {
  /** ISO date of the run. */
  date: '2026-10-30',
  lighthouse: '12.6.1',
  pages: [
    {
      path: '/',
      performance: 94,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
      fcp: 1.21,
      lcp: 3.08,
      tbt: 22,
      cls: 0,
      script: 168_263,
    },
    {
      path: '/colophon',
      performance: 98,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
      fcp: 0.9,
      lcp: 2.48,
      tbt: 11,
      cls: 0,
      script: 157_980,
    },
    {
      path: '/work/mcp',
      performance: 96,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
      fcp: 1.05,
      lcp: 2.78,
      tbt: 19,
      cls: 0,
      script: 178_123,
    },
  ] satisfies readonly PageMeasurement[],
  /** What the home page's largest contentful paint was in that run. */
  homeLcpElement: 'the hero’s tagline',
  /** Lighthouse's desktop preset, same day: the score every audited page got in every category. */
  desktopScore: 100,
  /**
   * The home page's performance score on GitHub's runners, which CI's floor is set against, and
   * the local score measured in the same round. It is an older run than `pages`, so the three
   * numbers travel together: re-measure them together, and never pair the range with `pages`.
   */
  ciRunners: { round: 'the first pass', low: 0.91, high: 0.93, localThen: 95 },
  /** The performance score the site aims for on mobile. A goal, not a measurement. */
  performanceTarget: 95,
  /** Playwright's are per project: the tests that ran and passed, and the ones a project skips. */
  tests: { unit: 472, e2e: { passed: 254, skipped: 26 } },
} as const;

function measurementOf(path: PageMeasurement['path']): PageMeasurement {
  const page = measured.pages.find((entry) => entry.path === path);
  if (!page) throw new Error(`measured.ts has no Lighthouse run for ${path}`);
  return page;
}

export const homeMeasurement = measurementOf('/');

/** "30 October 2026". Fixed to UTC so the build machine's zone cannot move the day. */
export const measuredOn = (iso: string = measured.date) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));

export const seconds = (value: number) => `${value.toFixed(2)} s`;
export const milliseconds = (value: number) => `${Math.round(value)} ms`;
export const kilobytes = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
/** A Lighthouse score as the 0–1 fraction CI asserts on: 95 → "0.95". */
export const fraction = (score: number) => (score / 100).toFixed(2);

/** One value when accessibility, best practices and SEO agree, otherwise all three in order. */
export function otherCategories(page: PageMeasurement): string {
  const values = [page.accessibility, page.bestPractices, page.seo];
  return values.every((value) => value === values[0]) ? String(values[0]) : values.join(' · ');
}
