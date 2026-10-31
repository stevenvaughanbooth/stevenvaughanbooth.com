import { findings } from './story';

/**
 * What review caught, grouped by area. Each finding pairs what was found with what is true now,
 * and both carry a visible label, so neither colour nor column position has to carry the meaning.
 */
export function Findings() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {findings.map((group) => {
        const id = `finding-${group.area.toLowerCase()}`;
        return (
          <section
            key={group.area}
            aria-labelledby={id}
            className="grid border-t border-line first:border-t-0 md:grid-cols-[9rem_minmax(0,1fr)]"
          >
            <h3 id={id} className="label px-5 pt-5 md:px-6 md:py-6">
              {group.area}
            </h3>
            <ul className="divide-y divide-line md:border-l md:border-line">
              {group.items.map((item) => (
                <li
                  key={item.found}
                  className="grid gap-x-8 gap-y-3 px-5 py-5 sm:grid-cols-2 md:px-6 md:py-6"
                >
                  <p className="text-sm leading-relaxed text-pretty text-muted">
                    <span className="mb-1.5 flex items-center gap-2 font-mono text-micro tracking-wide text-subtle uppercase">
                      <span aria-hidden className="size-1.5 rounded-full bg-amber" />
                      Found
                    </span>
                    {item.found}
                  </p>
                  <p className="text-sm leading-relaxed text-pretty">
                    <span className="mb-1.5 flex items-center gap-2 font-mono text-micro tracking-wide text-green uppercase">
                      <span aria-hidden className="size-1.5 rounded-full bg-green" />
                      Now
                    </span>
                    {item.now}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
