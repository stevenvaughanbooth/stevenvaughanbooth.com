/**
 * The site's components: what each one is, when its code loads, what it relies on and why it is
 * built that way. Under the hood (/colophon) lists them, and X-ray mode labels the page with
 * them, so this is the one place to describe a component. Every claim here must stay true of the
 * file it names.
 *
 * `id` matches the `data-component` attribute on the element a component renders. Entries with
 * `onPage: false` (a listener, a dialog loaded on intent) have no box of their own, so nothing
 * carries their id.
 */

export type ComponentKind = 'server' | 'client' | 'css';

export type ComponentId =
  // Layout: every page
  | 'site-header'
  | 'sections-menu'
  | 'theme-toggle'
  | 'ask-button'
  | 'xray-toggle'
  | 'site-footer'
  | 'shortcuts'
  | 'shortcuts-sheet'
  | 'xray-overlay'
  | 'palette-loader'
  | 'ask-palette'
  | 'error-boundary'
  // The home page
  | 'hero'
  | 'hero-ask-bar'
  | 'arrival'
  | 'proof-strip'
  | 'open-source'
  | 'reflex-demo'
  | 'copy-button'
  | 'count-up'
  | 'work'
  | 'team-multiplier'
  | 'progressive-disclosure'
  | 'metadata-platform'
  | 'experience'
  | 'career-timeline'
  | 'contact'
  | 'signal'
  // Case studies
  | 'case-study'
  | 'case-study-focus'
  // Under the hood
  | 'colophon';

export interface SiteComponent {
  /** Matches data-component="<id>" on the element that renders it. */
  id: ComponentId;
  /** Shown as <Name />. */
  name: string;
  /** Repo-relative path of the main file. */
  file: string;
  kind: ComponentKind;
  /**
   * Client modules a server component renders inside its box, by file name, e.g.
   * ['arrival-shell.tsx'], or by their path under src/components where names repeat
   * ('visuals/team-multiplier/shell.tsx'). components.test.ts checks the list against the code.
   */
  islands?: readonly string[];
  /** When its JavaScript loads, in a few words: 'No JavaScript', 'With the page', 'On intent', 'Near the viewport', 'After load and idle'. */
  loads: string;
  /** React and platform features it relies on, e.g. 'Server Component', 'ViewTransition', 'Activity', 'React.lazy', 'useEffectEvent', 'React Compiler', 'Popover API', 'scroll-driven animation', '<details name>'. */
  features: readonly string[];
  /** One or two sentences: why it is built this way. */
  why: string;
  /** False for code with no box of its own on the page (a listener, a lazily opened dialog). */
  onPage: boolean;
}

/** In reading order: the layout, the home page from top to bottom, then the other pages. */
export const siteComponents: readonly SiteComponent[] = [
  {
    id: 'site-header',
    name: 'SiteHeader',
    file: 'src/components/site-header.tsx',
    kind: 'server',
    islands: [
      'mobile-nav.tsx',
      'theme-toggle.tsx',
      'ask-button.tsx',
      'ask-shortcut.tsx',
      'shortcuts.tsx',
    ],
    loads: 'Islands with the page',
    features: ['Server Component', 'scroll-driven animation', 'Popover API'],
    why: 'Plain HTML with small islands in it; the section being read is marked by CSS view timelines, not a scroll listener.',
    onPage: true,
  },
  {
    id: 'sections-menu',
    name: 'SectionsMenu',
    file: 'src/components/site-header.tsx',
    kind: 'server',
    islands: ['mobile-nav.tsx'],
    loads: 'Island with the page',
    features: ['Server Component', 'Popover API'],
    why: 'A server-rendered button and popover that the Popover API opens, light-dismisses and closes on Escape; its one island, MobileNav, only moves focus to the chosen section’s heading on the home page.',
    onPage: true,
  },
  {
    id: 'theme-toggle',
    name: 'ThemeToggle',
    file: 'src/components/theme-toggle.tsx',
    kind: 'client',
    loads: 'With the page',
    features: [
      'useSyncExternalStore',
      'View Transitions',
      'Server-rendered props',
      'React Compiler',
    ],
    why: 'An inline script applies the saved theme before first paint, so this only flips it, revealing the new theme in a typed view transition.',
    onPage: true,
  },
  {
    id: 'ask-button',
    name: 'AskButton',
    file: 'src/components/ask/ask-button.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Custom events', 'React Compiler'],
    why: 'It never imports the palette: it announces on an event bus, and a hover or focus starts the palette’s download before the click.',
    onPage: true,
  },
  {
    id: 'xray-toggle',
    name: 'XrayToggle',
    file: 'src/components/xray/xray-toggle.tsx',
    kind: 'server',
    loads: 'On intent',
    features: ['Server Component', 'Event delegation'],
    why: 'A plain button with the build’s details written in at prerender: the shortcuts listener handles its presses, and the overlay, the stats and the blueprint styles download only on hover, focus, a press or X.',
    onPage: true,
  },
  {
    id: 'site-footer',
    name: 'SiteFooter',
    file: 'src/components/site-footer.tsx',
    kind: 'server',
    islands: ['shortcuts.tsx'],
    loads: 'Island with the page',
    features: ['Server Component'],
    why: 'Plain links, plus one island: the shortcuts button, for pointer users and anyone who has turned single keys off.',
    onPage: true,
  },
  {
    id: 'shortcuts',
    name: 'Shortcuts',
    file: 'src/components/shortcuts/shortcuts.tsx',
    kind: 'client',
    loads: 'With the page, its sheet on ?',
    features: ['Activity', 'import() on intent', '<dialog>', 'React Compiler'],
    why: 'One listener for /, T, X and ?, silent while you type or behind a dialog, which also hosts X-ray. Its sheet loads on first use, waits under <Activity>, and can turn single keys off (WCAG 2.1.4).',
    onPage: false,
  },
  {
    id: 'shortcuts-sheet',
    name: 'ShortcutsSheet',
    file: 'src/components/shortcuts/shortcuts-sheet.tsx',
    kind: 'client',
    loads: 'On intent',
    features: ['<dialog>', 'Activity', 'useLayoutEffect', 'React Compiler'],
    why: 'It loads on the first ? or press of Shortcuts, then waits under <Activity> with its state kept. A modal <dialog> makes the page inert while it is open, and its switch turns single keys off.',
    onPage: false,
  },
  {
    id: 'xray-overlay',
    name: 'XrayOverlay',
    file: 'src/components/xray/xray.tsx',
    kind: 'client',
    loads: 'On intent',
    features: [
      'import() on intent',
      'Activity',
      'View Transitions',
      'flushSync',
      'useEffectEvent',
      'PerformanceObserver',
      'React Compiler',
    ],
    why: 'The labels, cards, HUD and blueprint styles download on hover, focus, a press or X, and render inside the shortcuts listener under <Activity>. The peel is one view transition, and flushSync puts the overlay in its new snapshot.',
    onPage: false,
  },
  {
    id: 'palette-loader',
    name: 'PaletteLoader',
    file: 'src/components/ask/palette-loader.tsx',
    kind: 'client',
    loads: 'With the page',
    features: [
      'React.lazy',
      'Suspense',
      'Error boundary',
      'Server-rendered props',
      'React Compiler',
    ],
    why: 'It imports the palette only on intent, from ⌘K, the ask bar or an Ask button, and an error boundary keeps the page up if that chunk fails.',
    onPage: false,
  },
  {
    id: 'ask-palette',
    name: 'AskPalette',
    file: 'src/components/ask/ask-palette.tsx',
    kind: 'client',
    loads: 'On intent',
    features: ['<dialog>', 'ref as a prop', 'useImperativeHandle', 'React Compiler'],
    why: 'It holds the curated answers and the live client, so it loads only when asked; a modal <dialog> keeps focus, and answers render as text.',
    onPage: false,
  },
  {
    id: 'error-boundary',
    name: 'ErrorPage',
    file: 'src/app/error.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Error boundary', 'React Compiler'],
    why: 'Next.js renders it in place of a page that fails, inside the header and footer, with a way to try again; global-error.tsx stands in if the layout itself fails.',
    onPage: false,
  },
  {
    id: 'hero',
    name: 'Hero',
    file: 'src/components/sections/hero.tsx',
    kind: 'server',
    islands: ['hero-ask-bar.tsx', 'arrival-shell.tsx'],
    loads: 'Islands with the page',
    features: ['Server Component', 'getImageProps'],
    why: 'Name, tagline and portrait are in the first HTML, and the portrait is a plain <img> from getImageProps, so the largest paint waits on no script; the ask bar and the film’s frame are its islands.',
    onPage: true,
  },
  {
    id: 'hero-ask-bar',
    name: 'HeroAskBar',
    file: 'src/components/ask/hero-ask-bar.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Server-rendered props', 'Container queries', 'React Compiler'],
    why: 'It holds no answers: the server hands it three strings, it hands questions to the palette, and a hover or focus starts the palette’s download.',
    onPage: true,
  },
  {
    id: 'arrival',
    name: 'Arrival',
    file: 'src/components/film/arrival.tsx',
    kind: 'server',
    islands: ['arrival-shell.tsx', 'frame-film.tsx', 'film-controller.tsx'],
    loads: 'Film after load and idle',
    features: [
      'Server Component',
      'ViewTransition',
      'Activity',
      'useEffectEvent',
      'import() on intent',
      '<dialog>',
    ],
    why: 'The 4:5 film loads only after load and idle, from md up, with motion welcome, so it never delays the portrait; <ViewTransition> morphs it into the theater.',
    onPage: true,
  },
  {
    id: 'proof-strip',
    name: 'ProofStrip',
    file: 'src/components/sections/hero.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component', '<dl>'],
    why: 'A description list, the figure as the term and its context as the description, so each is read once; it spans both columns to balance the hero.',
    onPage: true,
  },
  {
    id: 'open-source',
    name: 'OpenSource',
    file: 'src/components/sections/open-source.tsx',
    kind: 'server',
    islands: ['copy-button.tsx', 'visuals/reflex-demo/shell.tsx'],
    loads: 'Islands with the page',
    features: ['Server Component', 'scroll-driven animation'],
    why: 'Adage’s evidence with its caveats, from profile.ts; the scroll-driven reveal moves the section without fading its text.',
    onPage: true,
  },
  {
    id: 'reflex-demo',
    name: 'ReflexDemo',
    file: 'src/components/visuals/reflex-demo.tsx',
    kind: 'server',
    islands: ['visuals/reflex-demo/shell.tsx', 'visuals/reflex-demo/controller.tsx'],
    loads: 'Controller near the viewport',
    features: [
      'Server Component',
      'React.lazy',
      'startTransition',
      'useSyncExternalStore',
      'Error boundary',
    ],
    why: 'The server renders the finished session and a transcript; the replay’s controller loads within 200 px of view, and if it fails the session stays.',
    onPage: true,
  },
  {
    id: 'copy-button',
    name: 'CopyButton',
    file: 'src/components/ui/copy-button.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Clipboard API', 'Server-rendered props', 'React Compiler'],
    why: 'A few lines of client code for one job; its icons come from the server as props, and a live region confirms the copy.',
    onPage: true,
  },
  {
    id: 'count-up',
    name: 'CountUp',
    file: 'src/components/sections/count-up.tsx',
    kind: 'css',
    loads: 'No JavaScript',
    features: ['timeline-trigger', '@property', 'CSS counters'],
    why: 'Counts up in CSS over the real number, which stays in the DOM for screen readers and copy, anchored at its right edge so nothing shifts.',
    onPage: true,
  },
  {
    id: 'work',
    name: 'Work',
    file: 'src/components/sections/work.tsx',
    kind: 'server',
    islands: [
      'ask-button.tsx',
      'visuals/team-multiplier/shell.tsx',
      'visuals/progressive-disclosure/shell.tsx',
      'visuals/metadata-platform/shell.tsx',
    ],
    loads: 'Islands with the page',
    features: ['Server Component', 'ViewTransition', 'scroll-driven animation'],
    why: 'Each theme’s intro and diagram sit in named <ViewTransition>s matching its case study, so opening one morphs them into place with no client code.',
    onPage: true,
  },
  {
    id: 'team-multiplier',
    name: 'TeamMultiplier',
    file: 'src/components/visuals/team-multiplier.tsx',
    kind: 'server',
    islands: ['visuals/team-multiplier/shell.tsx', 'visuals/team-multiplier/controller.tsx'],
    loads: 'Controller near the viewport',
    features: ['Server Component', 'React.lazy', 'useSyncExternalStore', 'useEffectEvent'],
    why: 'One server-rendered SVG with every stage drawn and CSS picking the current one; the controller adds tabs and a tour that runs only on screen.',
    onPage: true,
  },
  {
    id: 'progressive-disclosure',
    name: 'ProgressiveDisclosure',
    file: 'src/components/visuals/progressive-disclosure.tsx',
    kind: 'server',
    islands: [
      'visuals/progressive-disclosure/shell.tsx',
      'visuals/progressive-disclosure/controller.tsx',
    ],
    loads: 'Controller near the viewport',
    features: ['Server Component', 'React.lazy', 'startTransition'],
    why: 'Every step is rendered on the server into one grid cell, so the card never changes height; the controller only wakes the tabs and Next.',
    onPage: true,
  },
  {
    id: 'metadata-platform',
    name: 'MetadataPlatform',
    file: 'src/components/visuals/metadata-platform.tsx',
    kind: 'server',
    islands: ['visuals/metadata-platform/shell.tsx', 'visuals/metadata-platform/controller.tsx'],
    loads: 'Controller near the viewport',
    features: ['Server Component', 'React.lazy', 'useEffectEvent'],
    why: 'Every scene of three stories is rendered on the server; the controller tours each phase once, holds on hover or focus, and stops when a visitor picks one.',
    onPage: true,
  },
  {
    id: 'experience',
    name: 'Experience',
    file: 'src/components/sections/experience.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component', 'scroll-driven animation'],
    why: 'Roles, awards and education as plain HTML; the awards keep their #recognition anchor, so old links and Ask Steven still land on them.',
    onPage: true,
  },
  {
    id: 'career-timeline',
    name: 'CareerTimeline',
    file: 'src/components/visuals/career-timeline.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component', '<details name>', 'getImageProps'],
    why: 'Each role is a <details> sharing one name, so opening one closes the rest with no script; from md up, CSS lays the same list out as a step chart.',
    onPage: true,
  },
  {
    id: 'contact',
    name: 'Contact',
    file: 'src/components/sections/contact.tsx',
    kind: 'server',
    islands: ['ask-button.tsx'],
    loads: 'Island with the page',
    features: ['Server Component', 'anchor positioning', 'scroll-driven animation'],
    why: 'Email first, on one line from 360 px and wrapping only before the @; the address carries the signal line’s anchor and view timeline.',
    onPage: true,
  },
  {
    id: 'signal',
    name: 'Signal',
    file: 'src/components/signal/signal.tsx',
    kind: 'css',
    loads: 'No JavaScript',
    features: ['anchor positioning', 'scroll-driven animation'],
    why: 'A line from the hero’s status dot to the email address, stretched by anchor positioning and drawn by scroll-driven animations, with no JavaScript.',
    onPage: true,
  },
  {
    id: 'case-study',
    name: 'CaseStudyArticle',
    file: 'src/components/case-study/case-study.tsx',
    kind: 'server',
    islands: [
      'focus.tsx',
      'ask-button.tsx',
      'visuals/team-multiplier/shell.tsx',
      'visuals/progressive-disclosure/shell.tsx',
      'visuals/metadata-platform/shell.tsx',
    ],
    loads: 'Islands with the page',
    features: ['Server Component', 'ViewTransition'],
    why: 'Prerendered per theme (the route’s generateStaticParams names them), with the Work section’s intro and diagram in identical markup so the two morph; the pager’s transition type hands a title to the next page.',
    onPage: true,
  },
  {
    id: 'case-study-focus',
    name: 'CaseStudyFocus',
    file: 'src/components/case-study/focus.tsx',
    kind: 'client',
    loads: 'With the case studies',
    features: ['useSyncExternalStore', 'React Compiler'],
    why: 'Next.js leaves focus on a link the new page lacks; this moves it to the heading on arrival, and back to the opening link after Back.',
    onPage: false,
  },
  {
    id: 'colophon',
    name: 'ColophonPage',
    file: 'src/app/colophon/page.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component', 'Static prerendering'],
    why: 'This list, the budgets and the versions are imported at build time from the files X-ray mode, Lighthouse CI and the build read, so those stay in step with the code. The measured scores and test counts are typed in from a dated run.',
    onPage: true,
  },
];

const byId = new Map<string, SiteComponent>(siteComponents.map((entry) => [entry.id, entry]));

export function componentById(id: string): SiteComponent | undefined {
  return byId.get(id);
}
