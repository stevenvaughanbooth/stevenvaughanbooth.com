import type { ReactNode } from 'react';
import { accentText } from '@/components/ui/accent';
import type { Theme } from '@/content/profile';
import { Morph, morphName } from './morph';

interface ThemeIntroProps {
  theme: Theme;
  /** h3 in the home page's Work section; h1 at the head of the case study. */
  heading: 'h1' | 'h3';
  headingId: string;
  /** Lets the heading take focus from script, as the case study's does on arrival. */
  focusable?: boolean;
  /** Shown before the kicker, outside the morph, e.g. "Case study /". */
  eyebrow?: ReactNode;
}

/**
 * A Work theme's kicker, title and lede. The home page and the case study render the same markup
 * in the same column, so each part morphs into the other at the same size.
 */
export function ThemeIntro({
  theme,
  heading: Heading,
  headingId,
  focusable,
  eyebrow,
}: ThemeIntroProps) {
  // Sized to its text on both pages, so the morph moves it without scaling it.
  const kicker = (
    <Morph name={morphName.kicker(theme.id)}>
      <p className="label flex w-fit flex-wrap items-center gap-x-3 gap-y-1">
        <span className={accentText[theme.accent]}>{theme.index}</span>
        <span>{theme.kicker}</span>
      </p>
    </Morph>
  );
  return (
    <>
      {eyebrow ? (
        // Stacked on small screens, where the two would wrap anyway; one row from sm.
        <div className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          {eyebrow}
          {kicker}
        </div>
      ) : (
        kicker
      )}
      <Morph name={morphName.title(theme.id)}>
        <Heading
          id={headingId}
          tabIndex={focusable ? -1 : undefined}
          className="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
        >
          {theme.title}
        </Heading>
      </Morph>
      <Morph name={morphName.lede(theme.id)}>
        <p className="mt-5 text-lg leading-relaxed text-pretty text-muted">
          <span className="text-fg">{theme.lede}</span> {theme.body}
        </p>
      </Morph>
    </>
  );
}
