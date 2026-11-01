import { ArrowDown } from '@/components/ui/icons';
import { homeMeasurement, measured, otherCategories, percent } from './measured';
import { Tile } from './tile';

interface ResultsProps {
  /** CI's performance floor, as the 0–1 score lighthouserc.json asserts. */
  floor: number;
  /** Where the full per-page numbers are, on this page. */
  detailsHref: `#${string}`;
}

/** "a point under", "on" or "2 points above": how far a score sits from the target. */
function against(score: number, target: number): string {
  const gap = Math.abs(target - score);
  if (gap === 0) return 'on';
  const points = gap === 1 ? 'a point' : `${gap} points`;
  return `${points} ${score < target ? 'under' : 'above'}`;
}

/** The headline numbers from `measured`, then the one caveat that matters. */
export function Results({ floor, detailsHref }: ResultsProps) {
  const home = homeMeasurement;
  const tiles = [
    {
      label: 'Lighthouse performance, home page, emulated mobile',
      value: String(home.performance),
    },
    { label: 'Accessibility, best practices and SEO', value: otherCategories(home) },
    { label: 'Unit tests, in Vitest', value: String(measured.tests.unit) },
    {
      label: 'End-to-end checks in Playwright, with axe, across desktop and Pixel 7',
      value: String(measured.tests.e2e.passed),
    },
  ];
  // The CI range comes from an earlier run than `home`, so it is shown with that run's own score,
  // in a sentence of its own. Every score is on Lighthouse's 0–100 scale, as the tiles show it.
  const ci = measured.ciRunners;
  const target = measured.performanceTarget;

  return (
    <>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {tiles.map((tile) => (
          <Tile key={tile.label} {...tile} />
        ))}
      </dl>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
        On Lighthouse’s desktop preset, every audited page scored {measured.desktopScore} in every
        category.
      </p>

      <section
        aria-labelledby="results-caveat"
        className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8"
      >
        <h3 id="results-caveat" className="label flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-amber" />
          The caveat
        </h3>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty">
          This run scored the home page {home.performance}, {against(home.performance, target)} my
          target of {target}. GitHub’s runners score lower than a local build: in {ci.round}, they
          scored it {percent(ci.low)} to {percent(ci.high)} while my local build scored{' '}
          {ci.localThen}. So CI’s floor is {percent(floor)}, and {target} stays the target.
        </p>

        <a
          href={detailsHref}
          className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-green hover:underline"
        >
          Every number, page by page <ArrowDown width={16} height={16} />
        </a>
      </section>
    </>
  );
}
