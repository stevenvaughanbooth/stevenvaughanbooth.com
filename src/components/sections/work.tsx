import Link from 'next/link';
import { AskButton } from '@/components/ask/ask-button';
import { caseStudyLinkId, workAnchor } from '@/components/case-study/ids';
import { FadeThrough } from '@/components/case-study/morph';
import { ThemeIntro } from '@/components/case-study/theme-intro';
import { ThemeVisual } from '@/components/case-study/theme-visual';
import { ArrowRight, Sparkle } from '@/components/ui/icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { caseStudyPath } from '@/content/case-studies';
import { themes, workIntro } from '@/content/profile';

/**
 * Three themes, each opening into its case study: the intro and the diagram morph into the case
 * study's header while the rest of the section fades through, and back again.
 */
export function Work() {
  return (
    <FadeThrough>
      <section
        id="work"
        aria-labelledby="work-title"
        className="border-t border-line py-20 md:py-28"
      >
        <div className="page">
          <SectionHeading id="work-title" label={workIntro.label} title={workIntro.title}>
            <p>{workIntro.scope}</p>
          </SectionHeading>

          <div className="mt-16 space-y-24 md:space-y-32">
            {themes.map((theme) => (
              <article
                key={theme.id}
                id={workAnchor(theme.id)}
                aria-labelledby={`work-${theme.id}-title`}
                className="reveal grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-14"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <ThemeIntro theme={theme} heading="h3" headingId={`work-${theme.id}-title`} />
                  <p className="mt-5 border-l-2 border-line-strong pl-4 text-sm leading-relaxed text-muted">
                    {theme.proof}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <Link
                      id={caseStudyLinkId(theme.id)}
                      href={caseStudyPath(theme.id)}
                      // Names each of the three links apart; it starts with the visible label.
                      aria-label={`Read the case study: ${theme.title}`}
                      className="group pill pill-outline pill-sm"
                    >
                      Read the case study
                      <ArrowRight
                        width={16}
                        height={16}
                        className="transition-transform motion-safe:group-hover:translate-x-0.5"
                      />
                    </Link>
                    <AskButton prompt={theme.prompt} className="pill pill-ghost pill-sm">
                      <Sparkle width={16} height={16} /> Ask about this
                    </AskButton>
                  </div>
                </div>
                <ThemeVisual id={theme.id} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </FadeThrough>
  );
}
