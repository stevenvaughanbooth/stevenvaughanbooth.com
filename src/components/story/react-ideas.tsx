import type { ReactNode } from 'react';
import { type ComponentId, componentById } from '@/content/components';
import { cardId, TagName } from './component-map';

export interface ReactIdea {
  title: string;
  body: ReactNode;
  why: string;
  /** The features in components.ts this idea is about. */
  features: readonly string[];
  /** A few components on the map that show it; each lists one of `features` (the tests check). */
  uses: readonly ComponentId[];
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
      {children}
    </code>
  );
}

/** The few ideas that run through the components. Only what is true of this code. */
export const reactIdeas: readonly ReactIdea[] = [
  {
    title: 'Server Components first, small islands',
    body: (
      <>
        Sections, header, footer and case studies render on the server.{' '}
        <Code>&apos;use client&apos;</Code> marks only the parts that need the browser, and
        server-rendered markup passes through them as props. Each gets just what it needs: the ask
        bar three suggested questions, the palette’s loader one email address.
      </>
    ),
    why: 'Static content costs no JavaScript, and the HTML is complete before any script runs.',
    features: ['Server-rendered props'],
    uses: ['hero-ask-bar', 'palette-loader', 'theme-toggle', 'copy-button'],
  },
  {
    title: 'Code that waits to be asked for',
    body: (
      <>
        <Code>React.lazy</Code> and <Code>import()</Code> hold the heavy parts back: the palette
        until a pointer or focus reaches an Ask control or <Code>⌘K</Code> is pressed, the shortcuts
        sheet until <Code>?</Code> or its footer button, the film’s player until a pointer or focus
        reaches its chip, a diagram’s controller until its card nears view.
      </>
    ),
    why: 'Lighthouse charges early JavaScript to the largest paint, so code the first read does not need waits.',
    features: ['React.lazy', 'import() on intent'],
    uses: ['palette-loader', 'shortcuts', 'arrival', 'reflex-demo'],
  },
  {
    title: 'The React Compiler does the memoizing',
    body: (
      <>
        <Code>reactCompiler: true</Code> memoizes the client components at build time; the source
        has no <Code>useMemo</Code>, <Code>useCallback</Code> or <Code>memo</Code>.
      </>
    ),
    why: 'Re-renders stay cheap, and components read as plain functions.',
    features: ['React Compiler'],
    uses: [],
  },
  {
    title: 'ViewTransition and Activity',
    body: (
      <>
        <Code>&lt;ViewTransition&gt;</Code> pairs elements by name across a render, so a Work theme
        morphs into its case study and the film’s frame into its theater.{' '}
        <Code>&lt;Activity&gt;</Code> hides without unmounting: effects off, state kept.
      </>
    ),
    why: 'React starts each morph from the commit that changes the page, so the morphs need no animation code. Only the theme switch and X-ray’s peel call startViewTransition themselves; the peel draws its fold with the Web Animations API.',
    features: ['ViewTransition', 'Activity'],
    uses: ['work', 'case-study', 'arrival', 'shortcuts'],
  },
  {
    title: 'The prerender is the still frame',
    body: (
      <>
        Hooks that read the browser start from the safe answer. With{' '}
        <Code>useSyncExternalStore</Code>, the server snapshot says motion reduced, page hidden,
        theme unknown; <Code>useInView</Code> says out of view until its IntersectionObserver
        reports. <Code>useEffectEvent</Code> lets an observer call the latest callback without
        subscribing again.
      </>
    ),
    why: 'The prerendered HTML is the finished, still state, and nothing moves until the browser says it may.',
    features: ['useSyncExternalStore', 'useEffectEvent'],
    uses: ['theme-toggle', 'team-multiplier', 'reflex-demo', 'case-study-focus'],
  },
  {
    title: 'CSS doing what JavaScript used to',
    body: (
      <>
        Scroll-driven animations raise sections, draw the signal line and mark the section being
        read; <Code>timeline-trigger</Code> counts figures up. The Popover API opens and dismisses
        the menu, and <Code>&lt;details name&gt;</Code> keeps one role open at a time. Each modal is
        a <Code>&lt;dialog&gt;</Code> opened from script, which makes the rest of the page inert and
        closes on Escape.
      </>
    ),
    why: 'The scroll effects, opening the menu and the roles need no script, and where the scroll effects are missing the page shows their end state.',
    features: [
      'scroll-driven animation',
      'timeline-trigger',
      'anchor positioning',
      'Popover API',
      '<details name>',
    ],
    uses: ['signal', 'count-up', 'sections-menu', 'career-timeline'],
  },
];

/** The ideas as numbered cards, each linking to a few components on the map that use it. */
export function ReactIdeas() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reactIdeas.map((idea, i) => (
        <li
          key={idea.title}
          className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6"
        >
          <h3 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight text-balance">
            <span aria-hidden className="font-mono text-sm font-normal text-green">
              {String(i + 1).padStart(2, '0')}
            </span>
            {idea.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{idea.body}</p>
          <p className="mt-3 border-l-2 border-green pl-3 text-sm leading-relaxed text-pretty">
            <span className="label mr-2 text-green">Why</span>
            {idea.why}
          </p>
          {idea.uses.length > 0 ? (
            <ul
              aria-label={`Where: ${idea.title}`}
              className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4"
            >
              {idea.uses.map((id) => (
                <li key={id}>
                  <a
                    href={`#${cardId(id)}`}
                    className="font-mono text-xs text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-green"
                  >
                    <TagName name={componentById(id)?.name ?? id} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
