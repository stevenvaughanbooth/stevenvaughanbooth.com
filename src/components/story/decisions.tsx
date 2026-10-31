import { decisions } from './story';

/** Steven's calls as a numbered grid. Phones: the number sits beside the call to save height. */
export function Decisions() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
      {decisions.map((decision, i) => (
        <li
          key={decision.call}
          className="grid grid-cols-[2rem_minmax(0,1fr)] bg-surface p-5 sm:block md:p-6"
        >
          <span aria-hidden className="font-mono text-sm leading-6 text-green">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="sm:mt-3">
            <p className="font-semibold tracking-tight text-balance">{decision.call}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">
              {decision.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
