/**
 * The site's components, as the X-ray mode ("Under the hood") and How I built this describe them:
 * what each one is, which file it lives in, whether it ships JavaScript, when that JavaScript
 * loads, and why it is built that way. Every component that draws a box of its own carries
 * `data-component="<id>"` on its root element, which is how X-ray finds and labels it.
 */

export type ComponentKind = 'server' | 'client' | 'css';

export type ComponentId =
  // Layout, on every page
  | 'site-header'
  | 'sections-menu'
  | 'theme-toggle'
  | 'ask-button'
  | 'xray-toggle'
  | 'site-footer'
  | 'shortcuts'
  | 'palette-loader'
  | 'ask-palette'
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
  // The case studies
  | 'case-study'
  | 'case-study-focus'
  // How I built this
  | 'colophon';

export interface SiteComponent {
  /** Matches data-component="<id>" on the element that renders it. */
  id: ComponentId;
  /** Shown as <Name />. */
  name: string;
  /** Repo-relative path of the main file. */
  file: string;
  kind: ComponentKind;
  /** Client modules inside a server component, by file name, e.g. ['arrival-shell.tsx']. */
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

export const siteComponents: readonly SiteComponent[] = [
  {
    id: 'site-header',
    name: 'SiteHeader',
    file: 'src/components/site-header.tsx',
    kind: 'server',
    islands: ['theme-toggle.tsx', 'mobile-nav.tsx', 'ask-button.tsx', 'shortcuts.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'Popover API', 'scroll-driven animation'],
    why: 'The links are plain anchors and the reading marks are view timelines, so only the buttons in it hydrate.',
    onPage: true,
  },
  {
    id: 'sections-menu',
    name: 'MobileNav',
    file: 'src/components/mobile-nav.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Popover API', 'React Compiler'],
    why: 'The native Popover API opens and dismisses the menu; the client code only moves focus to the section a link leads to.',
    onPage: true,
  },
  {
    id: 'theme-toggle',
    name: 'ThemeToggle',
    file: 'src/components/theme-toggle.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['useSyncExternalStore', 'View Transitions', 'React Compiler'],
    why: 'It reads the theme from the document, which an inline script set before first paint, and reveals the new one in a typed view transition.',
    onPage: true,
  },
  {
    id: 'ask-button',
    name: 'AskButton',
    file: 'src/components/ask/ask-button.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['React Compiler'],
    why: 'A hover or focus warms the palette’s code and a press opens it through a small event bus, so the palette is never in the initial bundle.',
    onPage: true,
  },
  {
    id: 'xray-toggle',
    name: 'XrayToggle',
    file: 'src/components/xray/xray-toggle.tsx',
    kind: 'server',
    loads: 'On intent',
    features: ['Server Component', 'View Transitions', 'dynamic import()'],
    why: 'A plain button: the shortcuts listener handles its presses, and the overlay, the stats and the blueprint styles download only on hover, focus, a press or X.',
    onPage: true,
  },
  {
    id: 'site-footer',
    name: 'SiteFooter',
    file: 'src/components/site-footer.tsx',
    kind: 'server',
    islands: ['shortcuts.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component'],
    why: 'Static links and the disclaimer; only the Keyboard shortcuts button is a client island.',
    onPage: true,
  },
  {
    id: 'shortcuts',
    name: 'Shortcuts',
    file: 'src/components/shortcuts/shortcuts.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Activity', 'dynamic import()', 'React Compiler'],
    why: 'A keydown listener for /, T, X and ?; the sheet’s code loads only when it is asked for, and stays mounted under <Activity> once it has.',
    onPage: false,
  },
  {
    id: 'palette-loader',
    name: 'PaletteLoader',
    file: 'src/components/ask/palette-loader.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['React.lazy', 'Suspense', 'error boundary'],
    why: 'It listens for ⌘K and the Ask buttons’ events and loads the palette on intent; an error boundary keeps the page up if it fails.',
    onPage: false,
  },
  {
    id: 'ask-palette',
    name: 'AskPalette',
    file: 'src/components/ask/ask-palette.tsx',
    kind: 'client',
    loads: 'On intent',
    features: ['React.lazy', 'useImperativeHandle', '<dialog>'],
    why: 'The palette is the largest client module, so it downloads only when a visitor points at, focuses or uses an Ask control.',
    onPage: false,
  },
  {
    id: 'hero',
    name: 'Hero',
    file: 'src/components/sections/hero.tsx',
    kind: 'server',
    islands: ['hero-ask-bar.tsx', 'arrival-shell.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'getImageProps'],
    why: 'The name, tagline, links and portrait are in the HTML, so the first paint needs no script.',
    onPage: true,
  },
  {
    id: 'hero-ask-bar',
    name: 'HeroAskBar',
    file: 'src/components/ask/hero-ask-bar.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['container queries', 'React Compiler'],
    why: 'It holds no answers: a server component hands it three suggestions, and it passes questions to the palette.',
    onPage: true,
  },
  {
    id: 'arrival',
    name: 'Arrival',
    file: 'src/components/film/arrival.tsx',
    kind: 'server',
    islands: ['arrival-shell.tsx', 'frame-film.tsx', 'film-controller.tsx'],
    loads: 'After load and idle',
    features: ['ViewTransition', 'Activity', 'useEffectEvent'],
    why: 'The portrait paints first; the film loads only after the page has settled, and the theater’s player only on intent.',
    onPage: true,
  },
  {
    id: 'proof-strip',
    name: 'ProofStrip',
    file: 'src/components/sections/hero.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component'],
    why: 'Four highlights from profile.ts as a description list, so each figure is read once with its context.',
    onPage: true,
  },
  {
    id: 'open-source',
    name: 'OpenSource',
    file: 'src/components/sections/open-source.tsx',
    kind: 'server',
    islands: ['reflex-demo/shell.tsx', 'copy-button.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'scroll-driven animation'],
    why: 'Adage’s summary, evidence and install command render on the server; the replay and the copy button are islands.',
    onPage: true,
  },
  {
    id: 'reflex-demo',
    name: 'ReflexDemo',
    file: 'src/components/visuals/reflex-demo.tsx',
    kind: 'server',
    islands: ['reflex-demo/shell.tsx', 'reflex-demo/controller.tsx'],
    loads: 'Near the viewport',
    features: ['React.lazy', 'startTransition', 'IntersectionObserver'],
    why: 'The finished session is in the HTML; the controller that replays it loads as the card comes within 200 px of the viewport.',
    onPage: true,
  },
  {
    id: 'copy-button',
    name: 'CopyButton',
    file: 'src/components/ui/copy-button.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['Clipboard API', 'React Compiler'],
    why: 'Its icons arrive as server-rendered children, so the island is only the copy and its confirmation.',
    onPage: true,
  },
  {
    id: 'count-up',
    name: 'CountUp',
    file: 'src/components/sections/count-up.tsx',
    kind: 'css',
    loads: 'No JavaScript',
    features: ['scroll-triggered animation', '@property'],
    why: 'The real figure is always in the DOM; the count is drawn over it in CSS, so nothing reads a wrong number.',
    onPage: true,
  },
  {
    id: 'work',
    name: 'Work',
    file: 'src/components/sections/work.tsx',
    kind: 'server',
    islands: ['ask-button.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'ViewTransition'],
    why: 'Each theme’s intro and diagram morph into its case study with React’s <ViewTransition>, while the rest fades through.',
    onPage: true,
  },
  {
    id: 'team-multiplier',
    name: 'TeamMultiplier',
    file: 'src/components/visuals/team-multiplier.tsx',
    kind: 'server',
    islands: ['team-multiplier/shell.tsx', 'team-multiplier/controller.tsx'],
    loads: 'Near the viewport',
    features: ['React.lazy', 'startTransition', 'IntersectionObserver'],
    why: 'The diagram renders on the server; its tour’s controller loads as the card nears view.',
    onPage: true,
  },
  {
    id: 'progressive-disclosure',
    name: 'ProgressiveDisclosure',
    file: 'src/components/visuals/progressive-disclosure.tsx',
    kind: 'server',
    islands: ['progressive-disclosure/shell.tsx', 'progressive-disclosure/controller.tsx'],
    loads: 'Near the viewport',
    features: ['React.lazy', 'startTransition', 'IntersectionObserver'],
    why: 'The diagram renders on the server; its controller loads as the card nears view.',
    onPage: true,
  },
  {
    id: 'metadata-platform',
    name: 'MetadataPlatform',
    file: 'src/components/visuals/metadata-platform.tsx',
    kind: 'server',
    islands: ['metadata-platform/shell.tsx', 'metadata-platform/controller.tsx'],
    loads: 'Near the viewport',
    features: ['React.lazy', 'startTransition', 'IntersectionObserver'],
    why: 'The diagram renders on the server; its tour’s controller loads as the card nears view.',
    onPage: true,
  },
  {
    id: 'experience',
    name: 'Experience',
    file: 'src/components/sections/experience.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component'],
    why: 'The career, awards and education are static content, so the section ships no JavaScript.',
    onPage: true,
  },
  {
    id: 'career-timeline',
    name: 'CareerTimeline',
    file: 'src/components/visuals/career-timeline.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component', '<details name>'],
    why: 'Each role is a native disclosure sharing one name, so opening one closes the others with no script.',
    onPage: true,
  },
  {
    id: 'contact',
    name: 'Contact',
    file: 'src/components/sections/contact.tsx',
    kind: 'server',
    islands: ['ask-button.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'CSS anchor positioning'],
    why: 'Email first, as a plain link; the signal line ends on it.',
    onPage: true,
  },
  {
    id: 'signal',
    name: 'Signal',
    file: 'src/components/signal/signal.tsx',
    kind: 'css',
    loads: 'No JavaScript',
    features: ['CSS anchor positioning', 'scroll-driven animation'],
    why: 'Anchor positioning stretches the line between the status dot and the email, and scroll draws it, with no script.',
    onPage: true,
  },
  {
    id: 'case-study',
    name: 'CaseStudyArticle',
    file: 'src/components/case-study/case-study.tsx',
    kind: 'server',
    islands: ['focus.tsx', 'ask-button.tsx'],
    loads: 'No JavaScript',
    features: ['Server Component', 'ViewTransition', 'generateStaticParams'],
    why: 'Each case study is prerendered, and its header morphs from the Work section with React’s <ViewTransition>.',
    onPage: true,
  },
  {
    id: 'case-study-focus',
    name: 'CaseStudyFocus',
    file: 'src/components/case-study/focus.tsx',
    kind: 'client',
    loads: 'With the page',
    features: ['useSyncExternalStore'],
    why: 'It puts focus on the heading on arrival and back on the link after Back, and renders nothing.',
    onPage: false,
  },
  {
    id: 'colophon',
    name: 'Colophon',
    file: 'src/app/colophon/page.tsx',
    kind: 'server',
    loads: 'No JavaScript',
    features: ['Server Component'],
    why: 'The story and its measured results are read from the files CI uses, at build time.',
    onPage: true,
  },
];

const byId = new Map<string, SiteComponent>(siteComponents.map((entry) => [entry.id, entry]));

export function componentById(id: string): SiteComponent | undefined {
  return byId.get(id);
}
