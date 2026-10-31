'use client';

import { type FormEvent, useId, useRef } from 'react';
import { ArrowRight, Sparkle } from '@/components/ui/icons';
import { QUESTION_MAX } from '@/lib/ask-contract';
import { askBarFieldId, openAsk, warmAsk } from './ask-events';
import { Locate } from './locate-icon';

export interface HeroSuggestion {
  text: string;
  /** True when asking it shows a place on the page rather than answering in the palette. */
  shows: boolean;
}

interface HeroAskBarProps {
  suggestions: readonly HeroSuggestion[];
  className?: string;
}

/**
 * The hero's ask bar. It holds no answers itself: hovering or focusing it is the intent that starts
 * the palette's download, and submitting hands the question to the palette, which answers it (or,
 * for "show me…", shows the place). The site's "/" shortcut (shortcuts/shortcuts.tsx) puts the
 * cursor here while the bar is in view, by its fixed id.
 */
export function HeroAskBar({ suggestions, className }: HeroAskBarProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = input.current;
    const question = field?.value.trim() ?? '';
    // An empty bar still opens the palette, with its topics and sections to browse.
    openAsk(question ? { question } : {});
    if (field) field.value = '';
  }

  return (
    <div className={className} onPointerEnter={warmAsk} onFocus={warmAsk}>
      {/*
       * method="dialog" makes a submit before hydration a no-op (it closes only a dialog the form
       * is in), so an early Enter never reloads the page with the question in its URL.
       */}
      <form
        method="dialog"
        aria-label="Ask about my work"
        onSubmit={submit}
        className="group flex h-14 items-center gap-3 rounded-2xl border border-line-strong bg-surface pr-2 pl-4 shadow-card transition-[border-color,box-shadow] focus-within:border-green focus-within:ring-4 focus-within:ring-green/15 forced-colors:focus-within:outline-2 forced-colors:focus-within:outline-offset-2 forced-colors:focus-within:outline-[Highlight]"
      >
        <Sparkle width={18} height={18} className="shrink-0 text-green" />
        <label htmlFor={askBarFieldId} className="sr-only">
          Ask about my work
        </label>
        <input
          ref={input}
          id={askBarFieldId}
          name="question"
          type="text"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={QUESTION_MAX}
          placeholder="Ask about my work…"
          aria-keyshortcuts="/"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle focus-visible:outline-none md:text-[1.05rem]"
        />
        <kbd
          aria-hidden
          className="hidden size-6 shrink-0 place-items-center rounded-md border border-line bg-elevated font-mono text-micro text-muted group-focus-within:hidden pointer-fine:grid"
        >
          /
        </kbd>
        {/* Quiet beside the hero's primary action until the visitor is in the bar. */}
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-elevated px-3.5 text-sm font-medium text-fg transition-colors group-focus-within:border-transparent group-focus-within:bg-fg group-focus-within:text-bg hover:border-line-strong"
        >
          Ask <ArrowRight width={16} height={16} />
        </button>
      </form>
      {suggestions.length > 0 ? (
        <div
          role="group"
          aria-labelledby={`${id}-try`}
          className="@container mt-3 flex flex-wrap items-center gap-2"
        >
          <p id={`${id}-try`} className="label mr-1">
            Try
          </p>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => openAsk({ prompt: suggestion.text })}
              // All three fit on one row (about 42.6rem) only once the hero's text column is at its
              // widest (43.25rem). Anywhere narrower the middle one gives way, so the first and the
              // last share a row, or take two in a column as narrow as a phone's, never three.
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg ${index > 0 && index < suggestions.length - 1 ? '@max-[43rem]:hidden' : ''}`}
            >
              {suggestion.shows ? (
                <Locate width={14} height={14} className="shrink-0 text-green" />
              ) : null}
              {suggestion.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
