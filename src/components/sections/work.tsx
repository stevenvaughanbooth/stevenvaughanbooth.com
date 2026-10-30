import type { ComponentType } from 'react';
import { AskButton } from '@/components/ask/ask-button';
import { accentText } from '@/components/ui/accent';
import { Sparkle } from '@/components/ui/icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { MetadataPlatform } from '@/components/visuals/metadata-platform';
import { ProgressiveDisclosure } from '@/components/visuals/progressive-disclosure';
import { TeamMultiplier } from '@/components/visuals/team-multiplier';
import { type Theme, themes, workIntro } from '@/content/profile';

const visuals: Record<Theme['id'], ComponentType> = {
  devtools: TeamMultiplier,
  mcp: ProgressiveDisclosure,
  platform: MetadataPlatform,
};

export function Work() {
  return (
    <section id="work" aria-labelledby="work-title" className="border-t border-line py-20 md:py-28">
      <div className="page">
        <SectionHeading id="work-title" label={workIntro.label} title={workIntro.title}>
          <p>{workIntro.scope}</p>
        </SectionHeading>

        <div className="mt-16 space-y-24 md:space-y-32">
          {themes.map((theme) => {
            const Visual = visuals[theme.id];
            return (
              <article
                key={theme.id}
                id={`work-${theme.id}`}
                aria-labelledby={`work-${theme.id}-title`}
                className="reveal grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-14"
              >
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <p className="label flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={accentText[theme.accent]}>{theme.index}</span>
                    <span>{theme.kicker}</span>
                  </p>
                  <h3
                    id={`work-${theme.id}-title`}
                    className="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
                  >
                    {theme.title}
                  </h3>
                  <p className="mt-5 text-lg leading-relaxed text-pretty text-muted">
                    <span className="text-fg">{theme.lede}</span> {theme.body}
                  </p>
                  <p className="mt-5 border-l-2 border-line-strong pl-4 text-sm leading-relaxed text-muted">
                    {theme.proof}
                  </p>
                  <AskButton prompt={theme.prompt} className="mt-6 pill pill-outline pill-sm">
                    <Sparkle width={16} height={16} /> Ask about this
                  </AskButton>
                </div>
                <Visual />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
