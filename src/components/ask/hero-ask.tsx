import { heroSuggestions, matchQuestion } from '@/content/answers';
import { HeroAskBar, type HeroSuggestion } from './hero-ask-bar';

interface HeroAskProps {
  /** Placement only, e.g. `col-span-2 mt-8 max-w-xl` in the hero's grid. */
  className?: string;
}

/**
 * Ask Steven, front and center: an ask bar with suggested questions under it, for the hero. A
 * Server Component, so the client bar receives three short strings instead of bundling the
 * curated answers, and the HTML is complete before any script runs. The palette itself still
 * loads only on intent.
 */
export function HeroAsk({ className }: HeroAskProps) {
  const suggestions: HeroSuggestion[] = heroSuggestions.map((text) => ({
    text,
    shows: matchQuestion(text).kind === 'show',
  }));
  return <HeroAskBar suggestions={suggestions} className={className} />;
}
