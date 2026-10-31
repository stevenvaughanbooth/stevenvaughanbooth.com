import type { Route } from 'next';
import Link from 'next/link';
import { AskButton } from '@/components/ask/ask-button';
import { accentText } from '@/components/ui/accent';
import { ArrowRight, Sparkle } from '@/components/ui/icons';
import {
  adjacentCaseStudies,
  type CaseStudy,
  type CaseStudyId,
  type CaseStudyPart,
  caseStudyParts,
  caseStudyPath,
  findCaseStudy,
} from '@/content/case-studies';
import { type Accent, workIntro } from '@/content/profile';
import { caseStudyAnchors } from '@/lib/page-targets';
import { CaseStudyFocus } from './focus';
import { caseStudyLinkId, workAnchor } from './ids';
import { FadeThrough, Morph, morphName, pagerTransition } from './morph';
import { ThemeIntro } from './theme-intro';
import { ThemeVisual } from './theme-visual';

const headingId = caseStudyAnchors.title;

const pad = (n: number) => String(n).padStart(2, '0');

const backHref = (id: CaseStudyId): Route => `/#${workAnchor(id)}`;

/** The rail's step numbers take the theme's accent on hover. Tailwind needs full class names. */
const accentHover: Record<Accent, string> = {
  green: 'group-hover:text-green',
  amber: 'group-hover:text-amber',
  lilac: 'group-hover:text-lilac',
  blue: 'group-hover:text-blue',
};

const inlineLink =
  'inline-flex items-center gap-1.5 text-sm font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-current';

const card =
  'group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition-colors hover:border-line-strong md:p-8';

/**
 * A Work theme as a long-form page. The header repeats the theme's place on the home page, intro
 * beside diagram in the same columns, so both morph into place, and the rest of the page follows:
 * the problem, the approach, what changed and what's next, then the neighbouring case studies.
 * Everything renders on the server; the diagram's shell and the focus helper are the only client
 * code of its own.
 */
export function CaseStudyArticle({ study }: { study: CaseStudy }) {
  const { theme } = study;
  return (
    <FadeThrough>
      <article aria-labelledby={headingId} className="relative isolate">
        <div aria-hidden className="bg-grid absolute inset-x-0 top-0 -z-10 h-[32rem]" />
        <CaseStudyFocus
          heading={headingId}
          opener={caseStudyLinkId(study.id)}
          anchor={workAnchor(study.id)}
        />

        <header className="page grid gap-10 pt-24 md:pt-32 lg:grid-cols-[1fr_1.25fr] lg:gap-14">
          <div>
            {/* A client navigation, unlike the header's section links, so the theme morphs back. */}
            <Link href={backHref(study.id)} className="mb-8 -ml-3 pill pill-ghost pill-sm">
              <ArrowRight width={16} height={16} className="rotate-180" /> Back to Work
            </Link>
            <ThemeIntro
              theme={theme}
              heading="h1"
              headingId={headingId}
              focusable
              eyebrow={
                <p className="label">
                  Case study
                  <span aria-hidden className="ml-3 hidden text-line-strong sm:inline">
                    /
                  </span>
                </p>
              }
            />
            <AskButton prompt={theme.prompt} className="mt-6 pill pill-outline pill-sm">
              <Sparkle width={16} height={16} /> Ask about this
            </AskButton>
          </div>
          {/* Where Ask's "Show me the … diagram" lands on this page. Sized to the card, so the
              ring that marks it there fits the card. */}
          <div id={caseStudyAnchors.diagram} className="min-w-0 rounded-2xl lg:self-start">
            <ThemeVisual id={study.id} />
          </div>
        </header>

        <div className="page mt-16 grid gap-10 md:mt-24 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <p className="label">On this page</p>
            <ol className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
              {caseStudyParts.map((part, index) => (
                <li key={part.id}>
                  <a
                    href={`#${part.id}`}
                    className="group flex items-baseline gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg lg:rounded-lg lg:border-transparent lg:px-2 lg:hover:border-transparent lg:hover:bg-elevated"
                  >
                    <span
                      aria-hidden
                      className={`font-mono text-xs text-subtle ${accentHover[theme.accent]}`}
                    >
                      {pad(index + 1)}
                    </span>
                    {part.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0">
            {caseStudyParts.map((part, index) => (
              <Part
                key={part.id}
                id={part.id}
                label={part.label}
                index={index}
                accent={theme.accent}
                part={study.parts[part.id]}
              />
            ))}
          </div>
        </div>

        <Pager study={study} />
      </article>
    </FadeThrough>
  );
}

interface PartProps {
  id: string;
  label: string;
  index: number;
  accent: Accent;
  part: CaseStudyPart;
}

function Part({ id, label, index, accent, part }: PartProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-line py-14 first:border-t-0 first:pt-0 md:py-20"
    >
      <p className="label">
        <span className={accentText[accent]}>{pad(index + 1)}</span>
        <span aria-hidden className="mx-2 text-line-strong">
          /
        </span>
        {label}
      </p>
      <h2
        id={`${id}-title`}
        className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-balance md:text-3xl"
      >
        {part.title}
      </h2>
      <div className="mt-6 max-w-2xl space-y-5 text-lg leading-relaxed text-pretty text-muted">
        {part.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {part.steps ? (
        <ol
          className={`mt-10 grid gap-4 ${part.steps.length === 3 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}
        >
          {part.steps.map((step, stepIndex) => {
            const linked = step.caseStudy ? findCaseStudy(step.caseStudy) : undefined;
            return (
              <li
                key={step.name}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card"
              >
                <p className="label flex items-center gap-2">
                  <span className={accentText[accent]}>{pad(stepIndex + 1)}</span>
                  {step.name}
                </p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-pretty">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{step.body}</p>
                {step.call ? (
                  <p className="mt-4">
                    <code className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-sm text-fg">
                      {step.call}
                    </code>
                  </p>
                ) : null}
                {step.status || linked ? (
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                    {step.status ? (
                      <span className="label rounded-full border border-line px-2 py-0.5">
                        {step.status}
                      </span>
                    ) : null}
                    {linked ? (
                      <Link
                        href={caseStudyPath(linked.id)}
                        aria-label={`Read the case study: ${linked.theme.title}`}
                        className={inlineLink}
                      >
                        Read the case study <ArrowRight width={16} height={16} />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {part.note ? <p className="mt-4 text-sm text-subtle">{part.note}</p> : null}

      {part.facts ? (
        <dl
          className={`mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line ${part.facts.length > 1 ? 'max-w-2xl sm:grid-cols-2' : 'max-w-xs'}`}
        >
          {part.facts.map((fact) => (
            // The figure is the term and its context the description, so each is read once.
            <div key={fact.value} className="bg-surface p-5 md:p-6">
              <dt className="text-2xl font-semibold tracking-tight">{fact.value}</dt>
              <dd className="mt-1 text-sm leading-snug text-pretty text-muted">{fact.label}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {part.link ? (
        <p className="mt-8">
          {/* Home page sections load as pages, like the header's links; case studies morph. */}
          {part.link.href.startsWith('/#') ? (
            <a href={part.link.href} className={inlineLink}>
              {part.link.label} <ArrowRight width={16} height={16} />
            </a>
          ) : (
            <Link href={part.link.href} className={inlineLink}>
              {part.link.label} <ArrowRight width={16} height={16} />
            </Link>
          )}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The neighbouring case studies. Each title carries its morph name, so it glides into the next
 * page's heading. The first and last case studies fill the empty side with the way back.
 */
function Pager({ study }: { study: CaseStudy }) {
  const { previous, next } = adjacentCaseStudies(study.id);
  const back = (
    <Link href={backHref(study.id)} className={card}>
      <span className="label flex items-center gap-2">
        <ArrowRight width={14} height={14} className="rotate-180" /> Back to Work
      </span>
      <span className="mt-6 block text-xl font-semibold tracking-tight text-balance md:text-2xl">
        {workIntro.title}
      </span>
      <span className="mt-2 block text-sm text-muted">{workIntro.label}</span>
    </Link>
  );

  return (
    <nav aria-labelledby="case-study-pager" className="border-t border-line">
      <div className="page py-14 md:py-20">
        <h2 id="case-study-pager" className="label">
          More case studies
        </h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          <li>{previous ? <PagerLink study={previous} rel="prev" /> : back}</li>
          <li>{next ? <PagerLink study={next} rel="next" /> : back}</li>
        </ul>
      </div>
    </nav>
  );
}

function PagerLink({ study, rel }: { study: CaseStudy; rel: 'prev' | 'next' }) {
  const { theme } = study;
  return (
    <Link
      href={caseStudyPath(study.id)}
      rel={rel}
      transitionTypes={[pagerTransition]}
      className={card}
    >
      <span className="label flex items-center gap-2">
        {rel === 'prev' ? (
          <>
            <ArrowRight width={14} height={14} className="rotate-180" /> Previous
          </>
        ) : (
          <>
            Next <ArrowRight width={14} height={14} />
          </>
        )}
      </span>
      <span className="label mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={accentText[theme.accent]}>{theme.index}</span>
        <span>{theme.kicker}</span>
      </span>
      <Morph name={morphName.title(study.id)}>
        <span className="mt-2 block text-xl font-semibold tracking-tight text-balance md:text-2xl">
          {theme.title}
        </span>
      </Morph>
    </Link>
  );
}
