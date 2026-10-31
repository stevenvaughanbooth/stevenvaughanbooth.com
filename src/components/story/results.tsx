import { ArrowDown } from '@/components/ui/icons';
import { fraction, homeMeasurement, measured, otherCategories } from './measured';
import { Tile } from './tile';

interface ResultsProps {
  /** CI's performance floor, as the 0–1 score lighthouserc.json asserts. */
  floor: number;
  /** Where the full per-page numbers are, on this page. */
  detailsHref: `#${string}`;
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
  // The CI range comes from an earlier run than `home`, so it is shown with that run's own score.
  const ci = measured.ciRunners;

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
          On GitHub’s runners in {ci.round}, Lighthouse scored the home page {ci.low.toFixed(2)} to{' '}
          {ci.high.toFixed(2)}, where my local build scored {fraction(ci.localThen)}. So CI enforces
          a floor of {floor.toFixed(2)}, and {measured.performanceTarget} stays the target.
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
