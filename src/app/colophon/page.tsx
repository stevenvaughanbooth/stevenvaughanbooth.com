import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArrowUpRight, GitHub } from '@/components/ui/icons';
import { site } from '@/content/profile';
import lighthouse from '../../../lighthouserc.json';
import pkg from '../../../package.json';

export const metadata: Metadata = {
  title: 'How this site is built',
  description:
    'The principles, stack, rendering strategy, CI budgets, accessibility practices and Ask Steven security model behind this site.',
  alternates: { canonical: '/colophon' },
};

// Budgets and versions are read from the files CI and the build use, so this page cannot drift.
function budget(id: string, key: 'minScore' | 'maxNumericValue'): number {
  const assertions: Record<string, unknown[] | undefined> = lighthouse.ci.assert.assertions;
  const value = (assertions[id]?.[1] as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== 'number') throw new Error(`lighthouserc.json has no ${key} for ${id}`);
  return value;
}

function version(name: string): string {
  const deps: Record<string, string | undefined> = { ...pkg.dependencies, ...pkg.devDependencies };
  return deps[name]?.replace(/^[\^~]/, '') ?? '';
}

const scoreFloor = (category: string) => {
  const score = Math.round(budget(`categories:${category}`, 'minScore') * 100);
  return score === 100 ? '100' : `≥ ${score}`;
};
const kilobytes = (type: string) =>
  `≤ ${Math.round(budget(`resource-summary:${type}:size`, 'maxNumericValue') / 1024)} KB`;

const source = {
  repo: site.repo,
  architecture: `${site.repo}/blob/main/docs/architecture.md`,
  license: `${site.repo}/blob/main/LICENSE`,
  workflow: `${site.repo}/blob/main/.github/workflows/ci.yml`,
};

const sections = [
  { id: 'principles', label: 'Principles' },
  { id: 'stack', label: 'Stack' },
  { id: 'rendering', label: 'Rendering' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'ask-steven', label: 'Ask Steven' },
  { id: 'source', label: 'Source' },
] as const;

const goals = [
  {
    title: 'Fast for the first visitor',
    body: 'Content first, statically prerendered, and no gate in front of the work.',
  },
  {
    title: 'Clear in thirty seconds',
    body: 'Who Steven is, what he builds, proof of impact and how to reach him, before anything decorative.',
  },
  {
    title: 'The repository is a work sample',
    body: 'Typed content, a small client surface, tests, CI budgets and a documented security model.',
  },
];

const rules: ReactNode[] = [
  <>
    Server Components by default. <Code>&apos;use client&apos;</Code> only on interactive leaves,
    and code that is needed later loads later.
  </>,
  <>
    Every fact comes from <Code>src/content/profile.ts</Code>. No component hard-codes a career
    claim.
  </>,
  'No new runtime dependency without a clear reason. Prefer the platform: CSS, SVG and Web APIs.',
  'Every interaction works from a keyboard, shows its focus and respects reduced motion. Every visual works at 360 px wide and in both themes.',
];

interface StackRow {
  concern: string;
  choice: string;
  version?: string;
  why: string;
}

const stack: StackRow[] = [
  {
    concern: 'Framework',
    choice: 'Next.js App Router, React',
    version: `next ${version('next')} · react ${version('react')}`,
    why: 'Server Components ship no JavaScript for static content.',
  },
  {
    concern: 'Rendering',
    choice: 'Static prerendering',
    why: 'The site is content, so the CDN serves HTML with no server work.',
  },
  {
    concern: 'Language',
    choice: 'TypeScript, strict',
    version: version('typescript'),
    why: 'Content, routes (typedRoutes) and API contracts are type-checked, with noUncheckedIndexedAccess.',
  },
  {
    concern: 'Styling',
    choice: 'Tailwind CSS with design tokens',
    version: version('tailwindcss'),
    why: 'Small, purged CSS. Light and dark come from one set of CSS variables.',
  },
  {
    concern: 'Compiler',
    choice: 'React Compiler',
    why: 'Automatic memoization in client components, with no hand-written useMemo.',
  },
  {
    concern: 'Fonts',
    choice: 'next/font',
    why: 'Self-hosted from this origin, subset and preloaded, with metric-matched fallbacks, so text does not shift.',
  },
  {
    concern: 'Images',
    choice: 'next/image, getImageProps',
    why: 'AVIF and WebP at the right size, rendered on the server as a plain img, so no image component ships to the browser.',
  },
  {
    concern: 'Live answers',
    choice: 'Route Handler → Anthropic Messages API',
    version: 'claude-haiku-5-5',
    why: 'Claude Haiku 5.5 at low effort, streamed as plain text. The key stays on the server.',
  },
  {
    concern: 'Abuse limits',
    choice: 'Upstash Redis rate limits + Vercel BotID',
    why: 'A per-visitor allowance keyed by a signed cookie, a per-network cap, a per-minute burst limit, a daily cap and bot filtering.',
  },
  {
    concern: 'Tests',
    choice: 'Vitest, Playwright, axe-core, Lighthouse CI',
    version: `playwright ${version('@playwright/test')}`,
    why: 'Unit logic, end-to-end flows, automated accessibility and performance budgets.',
  },
  {
    concern: 'Hosting',
    choice: 'Vercel',
    why: 'Production from main, and a preview deployment for every other branch. Speed Insights is bundled only there.',
  },
];

const anatomy = [
  {
    kind: 'Static HTML',
    dot: 'bg-green',
    parts: 'Every section, the diagrams’ drawings and copy, the career timeline and this page',
    detail: 'Server Components, prerendered at build time. No component JavaScript.',
  },
  {
    kind: 'Client islands',
    dot: 'bg-amber',
    parts:
      'Theme toggle, Sections menu, copy button, Ask buttons, the scene list, and a small shell for each diagram and the film',
    detail:
      'Hydrated with the page. Animations pause off-screen and settle on a static frame under reduced motion.',
  },
  {
    kind: 'Loaded on demand',
    dot: 'bg-lilac',
    parts:
      'The Ask Steven palette, and each diagram’s and the film’s controller as its card nears view',
    detail:
      'Buttons announce “open” on a tiny event bus. The palette’s code loads on intent, when an Ask button is pointed at, focused or pressed, or on the shortcut; never with the page.',
  },
  {
    kind: 'Server only',
    dot: 'bg-blue',
    parts: '/api/ask and src/lib/ask',
    detail: 'Imports server-only, so bundling it for the browser fails the build.',
  },
];

const techniques = [
  {
    title: 'Theme without a flash',
    body: 'A one-line inline script applies a saved choice before first paint. Without one, CSS follows the system setting.',
  },
  {
    title: 'Motion in CSS',
    body: 'Sections rise into place with scroll-driven animations that never fade their text, and the theme switch uses a View Transition. Neither needs a library, and both stand down under prefers-reduced-motion.',
  },
  {
    title: 'A film that waits',
    body: 'The interlude is click-to-play. Its video downloads only after Play and is cached as immutable.',
  },
  {
    title: 'Locked-down headers',
    body: 'The Content Security Policy allows resources only from this origin and forbids framing. It permits inline scripts, because Next.js streams its payload through them and no nonce is used, but refuses inline event handlers.',
  },
  {
    title: 'One source of truth',
    body: 'Pages, curated answers, the Claude system prompt, JSON-LD, /profile.json and /llms.txt all read the same typed content module.',
  },
  {
    title: 'Mistakes caught at compile time',
    body: 'Typed routes check links between pages, and typed content means a missing field fails the typecheck, not the page.',
  },
];

const pipeline = [
  { step: 'Install', detail: 'pnpm, frozen lockfile' },
  { step: 'Typecheck', detail: 'tsc, generated route types' },
  { step: 'Lint', detail: 'ESLint, Next.js rules' },
  { step: 'Format', detail: 'Prettier check' },
  { step: 'Unit', detail: 'Vitest' },
  { step: 'Build', detail: 'next build' },
  { step: 'End to end', detail: 'Playwright, desktop + Pixel 7' },
  { step: 'Lighthouse', detail: `${lighthouse.ci.collect.numberOfRuns} runs per page` },
];

const scores = [
  { label: 'Performance', value: scoreFloor('performance') },
  { label: 'Accessibility', value: scoreFloor('accessibility') },
  { label: 'Best practices', value: scoreFloor('best-practices') },
  { label: 'SEO', value: scoreFloor('seo') },
];

const weights = [
  { label: 'JavaScript, compressed', value: kilobytes('script') },
  { label: 'Whole page, compressed', value: kilobytes('total') },
  {
    label: 'Video requests before Play',
    value: String(budget('resource-summary:media:count', 'maxNumericValue')),
  },
];

/** Measured with this repository's lighthouserc.json. Update after a change that moves them. */
const measured = {
  pages: [
    {
      path: '/',
      metrics: [
        { label: 'Performance', value: '95' },
        { label: 'First contentful paint', value: '1.21 s' },
        { label: 'Largest contentful paint', value: '2.93 s' },
        { label: 'Total blocking time', value: '21 ms' },
        { label: 'Layout shift', value: '0' },
        { label: 'JavaScript', value: '159 KB' },
      ],
    },
    {
      path: '/colophon',
      metrics: [
        { label: 'Performance', value: '98' },
        { label: 'First contentful paint', value: '0.91 s' },
        { label: 'Largest contentful paint', value: '2.48 s' },
        { label: 'Total blocking time', value: '10 ms' },
        { label: 'Layout shift', value: '0' },
        { label: 'JavaScript', value: '152 KB' },
      ],
    },
  ],
  note: 'Lighthouse 12.6.1 with this repository’s lighthouserc.json on 30 October 2026: emulated mobile, simulated throttling, median of 3 runs, against a local production build. Accessibility, best practices and SEO scored 100 on both pages. The home page’s largest contentful paint is the hero’s headline, and its performance score sits on the floor. On Lighthouse’s desktop preset, both pages score 100 in every category.',
};

const e2e = [
  'Every section renders in order, every in-page link lands, and section links move keyboard focus there.',
  'The theme toggle reports its state and persists across reloads with no flash of the wrong theme.',
  '⌘K or Ctrl+K opens Ask Steven as a dialog. Escape closes it and returns focus.',
  'The palette’s code loads only on intent, and a failed load leaves the page up with a working retry.',
  'The palette’s live, used-up, busy and curated states, with follow-ups that never send answers back.',
  'Dialogs are modal and keep focus. The metadata tour never moves the tab under keyboard focus.',
  'The film requests no video before Play.',
  'No console errors, and axe finds no serious or critical issue in either theme, mid-reveal or in the palette.',
  'No browser bundle contains the API key, the Anthropic SDK or a server secret’s name.',
];

const accessibility = [
  {
    title: 'Structure',
    body: 'Landmarks, one h1 per page, sections labelled by their headings, and a skip link as the first stop.',
  },
  {
    title: 'Keyboard',
    body: 'Every control is reachable in a logical order and shows a clear focus ring. Section links move focus into the section, and closing a dialog returns focus to where it was.',
  },
  {
    title: 'Motion',
    body: 'When a visitor asks for reduced motion, reveals, transitions and diagram animations stop. The guided tours and the Adage replay show their finished state.',
  },
  {
    title: 'Meaning',
    body: 'Color is never the only signal, and every diagram has a text alternative that tells the same story.',
  },
  {
    title: 'Checked in CI',
    body: 'Automated axe scans cover the home page and this page in light and dark, the open palette, and each section while its reveal is still moving. Lighthouse accessibility must score 100.',
  },
];

const security = [
  {
    title: 'The key stays on the server',
    points: [
      'Stored only as a Vercel environment variable marked Sensitive, which is write-only after creation.',
      'Read in a module that imports server-only. It is never logged and never sent to the browser.',
      'The system prompt is built from the public profile. There is nothing secret in it to leak.',
    ],
  },
  {
    title: 'Only real visitors, only valid requests',
    points: [
      'Vercel BotID verifies each request before any limit is checked or Claude is called, and fails closed when it cannot give a verdict.',
      'Only POST spends anything: same origin only, JSON under 16 KB, schema-validated with zod. Follow-ups carry the visitor’s earlier questions, never the answers.',
    ],
  },
  {
    title: 'A few questions, then email',
    points: [
      'Three live questions per visitor per 24 hours, keyed by a signed, HttpOnly first-party cookie, so people behind one network each get their own. A looser per-network cap bounds abuse. After that, the palette points to email.',
      'A site-wide limit of 10 questions a minute and 150 a day sits behind them. Without Redis, limits fail closed.',
      'A bounded max_tokens and a deadline, and answers rendered as plain text, never HTML.',
    ],
  },
  {
    title: 'A backstop if everything else fails',
    points: [
      'The key belongs to a dedicated Anthropic workspace with a low monthly spend limit.',
      'An environment flag or a Redis flag turns live answers off, and so does spending the day’s cap. The palette falls back to curated answers.',
    ],
  },
];

export default function ColophonPage() {
  return (
    <div className="relative isolate">
      <div aria-hidden className="bg-grid absolute inset-x-0 top-0 -z-10 h-[32rem]" />
      <article className="page pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-3xl">
          <p className="label">Colophon</p>
          <h1 className="mt-4 text-title font-semibold text-balance">How this site is built</h1>
          <p className="mt-6 text-lg leading-relaxed text-pretty text-muted md:text-xl">
            A personal site that doubles as a work sample. It is statically prerendered, typed from
            content to API, tested in a real browser on every change, and held to performance and
            accessibility budgets that fail the build.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={source.repo} className="pill pill-solid">
              <GitHub /> Source on GitHub
            </a>
            <a href={source.architecture} className="pill pill-outline">
              Architecture notes <ArrowUpRight />
            </a>
          </div>
        </header>

        <div className="mt-16 grid gap-10 md:mt-24 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
            <p className="label">On this page</p>
            <ol className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
              {sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="group flex items-baseline gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg lg:rounded-lg lg:border-transparent lg:px-2 lg:hover:border-transparent lg:hover:bg-elevated"
                  >
                    <span
                      aria-hidden
                      className="font-mono text-xs text-subtle group-hover:text-green"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0">
            <Section id="principles" title="Three goals settle every trade-off.">
              <ol className="grid gap-4 md:grid-cols-3">
                {goals.map((goal, i) => (
                  <li
                    key={goal.title}
                    className="rounded-2xl border border-line bg-surface p-6 shadow-card"
                  >
                    <span className="font-mono text-sm text-green">0{i + 1}</span>
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">{goal.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{goal.body}</p>
                  </li>
                ))}
              </ol>
              <h3 className="label mt-12">Rules of the road</h3>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {rules.map((rule, i) => (
                  <li key={i} className="flex gap-4 py-4 leading-relaxed text-pretty text-muted">
                    <span aria-hidden className="font-mono text-green">
                      →
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="stack"
              title="Standard tools, each with a reason."
              lede="Versions on this page are read from package.json at build time."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Specimen
                  className="font-sans"
                  name="DM Sans"
                  role="Text and headings"
                  sample="Aa"
                />
                <Specimen
                  className="font-mono"
                  name="IBM Plex Mono"
                  role="Code, labels and metadata"
                  sample="{ }"
                />
              </div>
              <dl className="mt-8 divide-y divide-line border-y border-line">
                {stack.map((row) => (
                  <div
                    key={row.concern}
                    className="grid gap-1 py-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-6"
                  >
                    <dt className="label pt-1">{row.concern}</dt>
                    <dd>
                      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium">{row.choice}</span>
                        {row.version ? (
                          <span className="font-mono text-xs text-subtle">{row.version}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{row.why}</p>
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section
              id="rendering"
              title="HTML first. JavaScript only where it earns its place."
              lede="Every page is prerendered at build time and served from the CDN as static HTML. React Server Components render the content, so text and layout arrive without waiting on JavaScript."
            >
              <h3 className="label">Anatomy of a page</h3>
              <ul className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line">
                {anatomy.map((layer) => (
                  <li
                    key={layer.kind}
                    className="grid gap-2 bg-surface p-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 md:p-6"
                  >
                    <p className="flex items-center gap-2.5 font-mono text-sm">
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${layer.dot}`} />
                      {layer.kind}
                    </p>
                    <div>
                      <p className="font-medium text-pretty">{layer.parts}</p>
                      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                        {layer.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
                {techniques.map((item) => (
                  <div key={item.title}>
                    <dt className="font-medium">{item.title}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section
              id="budgets"
              title="Budgets that fail the build."
              lede={
                <>
                  Lighthouse CI audits the home page and this one on emulated mobile with simulated
                  throttling, {lighthouse.ci.collect.numberOfRuns} runs each, and asserts on the
                  median run. The thresholds below are read from <Code>lighthouserc.json</Code>, the
                  same file CI uses.
                </>
              }
            >
              <h3 className="label">Minimum Lighthouse scores</h3>
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
                {scores.map((item) => (
                  <Tile key={item.label} {...item} />
                ))}
              </dl>
              <h3 className="label mt-8">Maximum transfer</h3>
              <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
                {weights.map((item) => (
                  <Tile key={item.label} {...item} />
                ))}
              </dl>
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
                These are floors, not the goal. The target is 100 in every category, no layout
                shift, and under 100 ms of total blocking time.
              </p>

              <h3 className="label mt-12">Last measured</h3>
              {measured.pages.map((page) => (
                <div key={page.path} className="mt-4">
                  <h4 className="font-mono text-sm text-muted">{page.path}</h4>
                  <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
                    {page.metrics.map((metric) => (
                      <Tile key={metric.label} {...metric} />
                    ))}
                  </dl>
                </div>
              ))}
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
                {measured.note}
              </p>

              <h3 className="label mt-12">The pipeline</h3>
              <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pipeline.map((stage, i) => (
                  <li key={stage.step} className="rounded-xl border border-line px-4 py-3">
                    <span className="font-mono text-xs text-subtle">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-1 font-medium">{stage.step}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{stage.detail}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm text-muted">
                Every push to main and every pull request runs the{' '}
                <a
                  href={source.workflow}
                  className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-green"
                >
                  CI workflow
                </a>
                . Every action is pinned to a commit SHA, and superseded runs are cancelled.
              </p>

              <h3 className="label mt-12">What the end-to-end suite proves</h3>
              <ul className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
                {e2e.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-pretty">
                    <span aria-hidden className="font-mono text-green">
                      ✓
                    </span>
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="accessibility"
              title="Built for keyboards, screen readers and reduced motion."
            >
              <dl className="divide-y divide-line border-y border-line">
                {accessibility.map((item) => (
                  <div
                    key={item.title}
                    className="grid gap-1 py-4 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-6"
                  >
                    <dt className="label pt-1">{item.title}</dt>
                    <dd className="max-w-2xl leading-relaxed text-pretty text-muted">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section
              id="ask-steven"
              title="A live model, with the key locked away."
              lede={
                <>
                  Press <Kbd>⌘K</Kbd> or <Kbd>Ctrl K</Kbd> to ask about Steven’s work. Preset topics
                  answer instantly from curated content. When live answers are on, other questions
                  go to Claude, under two rules: the API key is never exposed, and the cost of abuse
                  stays bounded even if every in-app control fails.
                </>
              }
            >
              <ul className="grid gap-4 md:grid-cols-2">
                {security.map((group, i) => (
                  <li
                    key={group.title}
                    className="rounded-2xl border border-line bg-surface p-6 shadow-card"
                  >
                    <span className="font-mono text-sm text-green">0{i + 1}</span>
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">{group.title}</h3>
                    <ul className="mt-3 space-y-2.5">
                      {group.points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-3 text-sm leading-relaxed text-pretty text-muted"
                        >
                          <span
                            aria-hidden
                            className="mt-2 size-1 shrink-0 rounded-full bg-line-strong"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
                Without a key or Redis, live answers are simply off and the palette answers from
                curated content. The site never depends on the model to work. Its own code sets one
                cookie, the signed visitor id, and only when live answers are configured. The CI
                suite checks that no browser bundle contains the key, the SDK or the names of server
                secrets.
              </p>
            </Section>

            <Section id="source" title="Read the source.">
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8">
                <p className="max-w-2xl leading-relaxed text-pretty text-muted">
                  The repository includes the architecture notes, the tests and the CI workflow
                  described here. For agents, <Code>/profile.json</Code> and <Code>/llms.txt</Code>{' '}
                  publish the same facts in machine-readable form.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={source.repo} className="pill pill-solid">
                    <GitHub /> View the repository
                  </a>
                  <a href={source.architecture} className="pill pill-outline">
                    Architecture notes <ArrowUpRight />
                  </a>
                </div>
                <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-subtle">
                  The code is{' '}
                  <a
                    href={source.license}
                    className="underline decoration-line-strong underline-offset-2 hover:text-fg"
                  >
                    MIT licensed
                  </a>
                  . The writing, the portrait, the film and the logos are not.
                </p>
              </div>
            </Section>
          </div>
        </div>
      </article>
    </div>
  );
}

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: (typeof sections)[number]['id'];
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  const index = sections.findIndex((section) => section.id === id);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-line py-14 first:border-t-0 first:pt-0 md:py-20"
    >
      <p className="label">
        <span className="text-green">{String(index + 1).padStart(2, '0')}</span>
        <span aria-hidden className="mx-2 text-line-strong">
          /
        </span>
        {sections[index]?.label}
      </p>
      <h2
        id={`${id}-title`}
        className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl"
      >
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-muted">{lede}</p>
      ) : null}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    // dt must come first in a dl; column-reverse shows the value on top, justify-end keeps values level.
    <div className="flex flex-col-reverse justify-end bg-surface p-5 md:p-6">
      <dt className="mt-1 text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</dd>
    </div>
  );
}

function Specimen({
  className,
  name,
  role,
  sample,
}: {
  className: string;
  name: string;
  role: string;
  sample: string;
}) {
  return (
    <figure className="flex items-center gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <span
        aria-hidden
        className={`grid size-16 shrink-0 place-items-center rounded-xl bg-elevated text-3xl font-medium ${className}`}
      >
        {sample}
      </span>
      <figcaption>
        <p className={`text-lg font-medium ${className}`}>{name}</p>
        <p className="text-sm text-muted">{role}</p>
      </figcaption>
    </figure>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
      {children}
    </code>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[0.8em] text-fg">
      {children}
    </kbd>
  );
}
