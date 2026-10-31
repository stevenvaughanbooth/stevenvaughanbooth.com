import { ArrowDown } from '@/components/ui/icons';
import { brief } from './story';

/** The brief in Steven's words, then his two conditions on live answers. */
export function Brief({ securityHref }: { securityHref: `#${string}` }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8">
        <p className="text-2xl leading-snug font-medium tracking-tight text-balance md:text-3xl">
          Make it “{brief.goal}.”
        </p>
        <div className="mt-6 border-t border-line pt-5">
          <p className="label">From the same brief</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {brief.qualities.map((quality) => (
              <li
                key={quality}
                className="rounded-full border border-line-strong px-3 py-1 text-sm text-fg"
              >
                “{quality}”
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section
        aria-labelledby="brief-conditions"
        className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8"
      >
        <h3 id="brief-conditions" className="label">
          My two conditions for live answers
        </h3>
        <ol className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8">
          {brief.conditions.map((condition, i) => (
            <li key={condition.title} className="flex gap-4">
              <span aria-hidden className="font-mono text-sm leading-6 text-green">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{condition.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                  {condition.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <a
          href={securityHref}
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-green hover:underline"
        >
          How the key is protected <ArrowDown width={16} height={16} />
        </a>
      </section>
    </div>
  );
}
