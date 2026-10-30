import { CopyButton } from '@/components/ui/copy-button';
import { ArrowUpRight, Check, Copy, GitHub } from '@/components/ui/icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { ReflexDemo } from '@/components/visuals/reflex-demo';
import { adage } from '@/content/profile';

export function OpenSource() {
  const facts = [adage.status, adage.language, adage.license, ...adage.harnesses];

  return (
    <section id="open-source" aria-labelledby="open-source-title" className="reveal py-20 md:py-28">
      <div className="page">
        <SectionHeading
          id="open-source-title"
          label={
            <>
              <span className="text-green">Open source</span> / {adage.name}
            </>
          }
          title={adage.tagline}
        >
          <p>{adage.summary}</p>
        </SectionHeading>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Project facts">
          {facts.map((fact) => (
            <li
              key={fact}
              className="rounded-full border border-line px-3 py-1 font-mono text-xs text-muted"
            >
              {fact}
            </li>
          ))}
        </ul>

        {/*
         * From lg the install row sits under the replay and the evidence fills the right column.
         * The 1fr second row absorbs the evidence column's extra height, so nothing stretches.
         */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:grid-rows-[auto_1fr]">
          <div className="lg:col-start-1 lg:row-start-1">
            <ReflexDemo />
          </div>

          <div className="flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <blockquote className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <p className="label">The question behind it</p>
              <p className="mt-3 text-xl leading-snug font-medium text-balance">
                “{adage.question}”
              </p>
            </blockquote>

            <section
              aria-labelledby="adage-evidence-title"
              className="rounded-2xl border border-line bg-surface p-6 shadow-card"
            >
              <h3 id="adage-evidence-title" className="label">
                Evidence so far
              </h3>
              <ul className="mt-5 divide-y divide-line">
                {adage.evidence.results.map((result) => (
                  <li key={result.study} className="py-5 first:pt-0">
                    <p className="text-sm font-medium text-green">{result.study}</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                      <span className="text-5xl font-semibold tracking-tight tabular-nums">
                        {result.value}
                      </span>
                      <span className="text-lg font-medium">{result.label}</span>
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-pretty">{result.detail}</p>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
                      {result.caveat}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line pt-5 text-sm leading-relaxed text-pretty text-muted">
                {adage.evidence.candor}
              </p>
              <a
                href={adage.links.evidence}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green hover:underline"
              >
                Methods and limitations <ArrowUpRight width={16} height={16} />
              </a>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="flex max-w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-4 font-mono text-sm">
              <span className="text-subtle select-none" aria-hidden>
                $
              </span>
              <code className="flex-1 overflow-x-auto whitespace-nowrap">{adage.install}</code>
              <CopyButton
                value={adage.install}
                label="Copy install command"
                icon={<Copy />}
                copiedIcon={<Check className="text-green" />}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={adage.links.repo} className="pill pill-solid">
                <GitHub /> View on GitHub
              </a>
              <a href={adage.links.site} className="pill pill-outline">
                Project site <ArrowUpRight />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
