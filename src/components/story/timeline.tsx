import { type TimelineEntry, timeline, who } from './story';

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "29 Oct 2026". The date part only, read as written, so no time zone can move it. */
export function formatDay(at: string): string {
  const [year, month, date] = at.slice(0, 10).split('-').map(Number);
  return day.format(new Date(year ?? 0, (month ?? 1) - 1, date ?? 1));
}

/**
 * The day as a rail of entries. Phones: the rail on the left, each date above its entry. From sm
 * the dates move into their own column left of the rail. Undated entries sit between their dated
 * neighbours. A later group of entries is its own rail, under a heading of its own, so its entries
 * take the level below it.
 */
export function Timeline({
  entries = timeline,
  heading: Heading = 'h3',
}: {
  entries?: TimelineEntry[];
  heading?: 'h3' | 'h4';
}) {
  return (
    <ol className="max-w-3xl">
      {entries.map((entry) => (
        <li
          key={entry.phase}
          className="group relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 pb-10 last:pb-0 sm:grid-cols-[6.5rem_1.25rem_minmax(0,1fr)] sm:gap-x-5"
        >
          {entry.at ? (
            <time
              dateTime={entry.at}
              className="label col-start-2 row-start-1 mb-2 sm:col-start-1 sm:mb-0 sm:pt-0.5 sm:text-right"
            >
              {formatDay(entry.at)}
            </time>
          ) : null}

          <span
            aria-hidden
            className="relative col-start-1 row-span-2 row-start-1 flex justify-center sm:col-start-2"
          >
            <span
              className={`relative z-10 mt-1 size-2.5 rounded-full ring-4 ring-bg ${entry.who ? who[entry.who].dot : 'border-2 border-line-strong bg-bg'}`}
            />
            <span className="absolute top-1 -bottom-10 w-px bg-line group-last:hidden" />
          </span>

          <div className="col-start-2 row-start-2 sm:col-start-3 sm:row-span-2 sm:row-start-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-green">{entry.phase}</span>
              {entry.who ? (
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-micro text-muted">
                  {who[entry.who].label}
                </span>
              ) : null}
            </p>
            <Heading className="mt-2 text-lg font-semibold tracking-tight">{entry.title}</Heading>
            <p className="mt-1 max-w-2xl leading-relaxed text-pretty text-muted">{entry.body}</p>
            {entry.chips ? (
              <ul aria-label={entry.chips.label} className="mt-4 flex flex-wrap gap-2">
                {entry.chips.items.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-muted"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
