import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComponentMap, KindLegend } from '@/components/story/component-map';
import {
  kilobytes as kb,
  measured,
  measuredOn,
  milliseconds,
  otherCategories,
  seconds,
} from '@/components/story/measured';
import { ReactIdeas } from '@/components/story/react-ideas';
import { Results } from '@/components/story/results';
import { Tile } from '@/components/story/tile';
import { ArrowUpRight, GitHub } from '@/components/ui/icons';
import { siteComponents } from '@/content/components';
import { person, site } from '@/content/profile';
import lighthouse from '../../../lighthouserc.json';
import pkg from '../../../package.json';

const title = 'Under the hood';
const description =
  'The React components behind Steven Booth’s site: where each one renders, when its code loads and why, then the stack, the budgets, accessibility and the Ask Steven security model.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/colophon' },
  openGraph: { type: 'website', url: '/colophon', siteName: person.name, title, description },
  twitter: { card: 'summary_large_image', title, description },
};

// Budgets and package versions are read from the files CI and the build use, so they always match
// what CI enforces and what was installed. The measured results are typed into measured.ts by hand.
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

/** The components and the React behind them first, then the colophon. Numbers come from here. */
const sections = [
  { id: 'components', label: 'Components' },
  { id: 'react', label: 'React' },
  { id: 'results', label: 'Results' },
  { id: 'stack', label: 'Stack' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'ask-steven', label: 'Ask Steven' },
  { id: 'source', label: 'Source' },
] as const;

type SectionId = (typeof sections)[number]['id'];

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
    why: 'Every page is prerendered at build time; only /api/ask runs on demand.',
  },
  {
    concern: 'Language',
    choice: 'TypeScript, strict',
    version: version('typescript'),
    why: 'Content, routes and the API contract are type-checked, with noUncheckedIndexedAccess.',
  },
  {
    concern: 'Content',
    choice: 'One typed module, profile.ts',
    why: 'Pages, curated answers, the system prompt, JSON-LD, /profile.json and /llms.txt all read it.',
  },
  {
    concern: 'Styling',
    choice: 'Tailwind CSS with design tokens',
    version: version('tailwindcss'),
    why: 'Each colour token is defined once, with light-dark(), for both themes.',
  },
  {
    concern: 'Fonts',
    choice: 'next/font',
    why: 'DM Sans and IBM Plex Mono, self-hosted and preloaded, with metric-matched fallbacks.',
  },
  {
    concern: 'Headers',
    choice: 'A Content Security Policy for this origin',
    why: 'Resources from this origin only, no framing and no inline event handlers, plus HSTS.',
  },
  {
    concern: 'Live answers',
    choice: 'Route Handler → Anthropic Messages API',
    version: 'claude-haiku-5-5',
    why: 'Claude Haiku 5.5, streamed as it is written. The key stays on the server.',
  },
  {
    concern: 'Tests',
    choice: 'Vitest, Playwright, axe-core, Lighthouse CI',
    version: `playwright ${version('@playwright/test')}`,
    why: 'Unit logic, end-to-end flows, accessibility scans and performance budgets.',
  },
  {
    concern: 'Hosting',
    choice: 'Vercel',
    why: 'Production from main, and a preview for every other branch.',
  },
];

const pipeline = [
  'a frozen-lockfile install',
  'typecheck',
  'lint',
  'format check',
  'unit tests',
  'the build',
  'Playwright on desktop and an emulated Pixel 7',
  `then Lighthouse, ${lighthouse.ci.collect.numberOfRuns} runs per page`,
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
    label: 'Video requests on a phone',
    value: String(budget('resource-summary:media:count', 'maxNumericValue')),
  },
];

const otherScores = [...new Set(measured.pages.map(otherCategories))];

/** The last run, from the module the results read too. Update the numbers there. */
const lastMeasured = {
  pages: measured.pages.map((page) => ({
    path: page.path,
    metrics: [
      { label: 'Performance', value: String(page.performance) },
      { label: 'First contentful paint', value: seconds(page.fcp) },
      { label: 'Largest contentful paint', value: seconds(page.lcp) },
      { label: 'Total blocking time', value: milliseconds(page.tbt) },
      { label: 'Layout shift', value: String(page.cls) },
      { label: 'JavaScript', value: kb(page.script) },
    ],
  })),
  note: `Accessibility, best practices and SEO scored ${otherScores.length === 1 ? `${otherScores[0]} on every page` : measured.pages.map((page) => `${otherCategories(page)} on ${page.path}`).join(', ')}. The home page’s largest contentful paint is ${measured.homeLcpElement}.`,
};

const accessibility = [
  {
    title: 'Structure',
    body: 'Landmarks, one h1 per page, sections named by their headings, and a skip link first.',
  },
  {
    title: 'Keyboard',
    body: 'Every control is reachable and shows its focus. Section links and closing dialogs put focus where it belongs, and single-key shortcuts can be turned off.',
  },
  {
    title: 'Motion',
    body: 'Under reduced motion nothing moves: the theme switch and the peel happen at once, tours and the replay show their end state, the signal line is drawn in full, and the film never plays by itself.',
  },
  {
    title: 'Meaning',
    body: 'Colour is never the only signal, and every diagram has a text alternative.',
  },
  {
    title: 'Checked in CI',
    body: 'axe scans both themes, mid-reveal and in the open dialogs, and Lighthouse accessibility must score 100.',
  },
];

const security = [
  {
    title: 'The key stays on the server',
    points: [
      'A Sensitive Vercel variable, read only by server-only modules, never logged or sent to the browser.',
      'The system prompt is built from the public profile, so nothing in it is secret.',
    ],
  },
  {
    title: 'Only valid requests, only real visitors',
    points: [
      'First the cheap checks: same origin, JSON of at most 16 KB, validated with zod. Follow-ups send earlier questions, never answers.',
      'Then Vercel BotID, before the rate limits or the model, failing closed.',
    ],
  },
  {
    title: 'A few questions, then email',
    points: [
      'Three per visitor per 24 hours, by a signed cookie, with a looser per-network cap. Then the palette points to email.',
      '10 a minute and 150 a day across the site. Without Redis, limits fail closed.',
    ],
  },
  {
    title: 'A backstop if everything else fails',
    points: [
      'A dedicated Anthropic workspace with a low monthly spend limit.',
      'A flag in the environment or in Redis turns live answers off; the palette falls back to curated answers.',
    ],
  },
];

export default function ColophonPage() {
  return (
    <div data-component="colophon" className="relative isolate">
      <div aria-hidden className="bg-grid absolute inset-x-0 top-0 -z-10 h-[32rem]" />
      <article className="page pt-32 pb-24 md:pt-40 md:pb-32">
        <header className="max-w-3xl">
          <p className="label">Colophon</p>
          <h1 className="mt-4 text-title font-semibold text-balance">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-pretty text-muted md:text-xl">
            The React components this site is made of. Each one renders on the server, as a small
            client island or in CSS alone, and each says when its code loads and why it is built
            that way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={source.repo} className="pill pill-solid">
              <GitHub /> Source on GitHub
            </a>
            {/*
             * The shortcuts listener, loaded with every page, picks up presses on this button and
             * loads X-ray, which keeps aria-pressed in step with the header's toggle. The name
             * stays the same in both states; pressed means the page is peeled back.
             */}
            <button
              type="button"
              data-xray-toggle
              aria-pressed="false"
              className="pill pill-outline aria-pressed:border-green aria-pressed:bg-elevated"
            >
              <Layers /> Peel back this page
            </button>
          </div>
        </header>

        <nav aria-label="On this page" className="mt-12 border-y border-line py-4 md:mt-16">
          <ol className="flex flex-wrap gap-x-1 gap-y-1">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="group flex items-baseline gap-2 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
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

        <div className="mt-12 md:mt-16">
          <Section
            id="components"
            title="The components, and why."
            lede={`${siteComponents.length} of them, grouped by where they render, with what each draws inside it. X-ray mode reads the same list to label the real page.`}
          >
            <KindLegend />
            <div className="mt-8">
              <ComponentMap />
            </div>
          </Section>

          <Section
            id="react"
            title="The React behind it."
            lede="A few ideas run through all of them."
          >
            <ReactIdeas />
          </Section>

          <Section
            id="results"
            title="The numbers, as measured."
            lede={`Lighthouse ${measured.lighthouse} on ${measuredOn()}: emulated mobile, simulated throttling, the median of ${lighthouse.ci.collect.numberOfRuns} runs against a local production build.`}
          >
            <Results floor={budget('categories:performance', 'minScore')} detailsHref="#budgets" />
          </Section>

          <Section
            id="stack"
            title="Standard tools, each with a reason."
            lede="Package versions on this page are read from package.json at build time."
          >
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {stack.map((row) => (
                <div key={row.concern} className="bg-surface p-5 md:max-lg:last:odd:col-span-2">
                  <dt className="label">{row.concern}</dt>
                  <dd className="mt-2">
                    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{row.choice}</span>
                      {row.version ? (
                        <span className="font-mono text-xs text-subtle">{row.version}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{row.why}</p>
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
                Lighthouse CI audits the home page, this one and a case study on emulated mobile,
                asserting on the median of {lighthouse.ci.collect.numberOfRuns} runs. These floors
                are read from <Code>lighthouserc.json</Code>, the file CI uses.
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
              The targets sit above the floors: {measured.performanceTarget} for performance, 100 in
              the other three categories, no layout shift and under 100 ms of blocking time.
            </p>

            <h3 className="label mt-12">Last measured</h3>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
              {lastMeasured.pages.map((page) => (
                <li
                  key={page.path}
                  className="grid gap-3 p-5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-6"
                >
                  <h4 className="font-mono text-sm text-muted sm:pt-0.5">{page.path}</h4>
                  {/* dt must come first in a dl; column-reverse shows each value above its label. */}
                  <dl className="grid grid-cols-3 gap-x-4 gap-y-3 lg:grid-cols-6">
                    {page.metrics.map((metric) => (
                      <div key={metric.label} className="flex flex-col-reverse justify-end">
                        <dt className="mt-0.5 text-xs leading-snug text-pretty text-muted">
                          {metric.label}
                        </dt>
                        <dd className="text-lg font-semibold tracking-tight tabular-nums">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
              {lastMeasured.note}
            </p>

            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-pretty text-muted">
              Every push to main and every pull request runs the{' '}
              <a
                href={source.workflow}
                className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-green"
              >
                CI workflow
              </a>
              : {pipeline.join(', ')}. Every action is pinned to a commit SHA.
            </p>
          </Section>

          <Section
            id="accessibility"
            title="Built for keyboards, screen readers and reduced motion."
          >
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {accessibility.map((item) => (
                <div key={item.title} className="bg-surface p-5 md:last:col-span-2">
                  <dt className="label">{item.title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-pretty text-muted">
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
                Press <Kbd>⌘K</Kbd> or <Kbd>Ctrl K</Kbd> to ask about my work. Preset topics answer
                from curated notes; other questions go to Claude, under two rules: the key is never
                exposed, and abuse stays cheap even if every in-app control fails.
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
          </Section>

          <Section id="source" title="Read the source.">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8">
              <p className="max-w-2xl leading-relaxed text-pretty">
                I built the site with Claude Code: Claude Opus 5.5 ran a team of agents that
                planned, built, reviewed and tested it, while I set the goal, made the product calls
                and approved the result.
              </p>
              <p className="mt-4 max-w-2xl leading-relaxed text-pretty text-muted">
                The repository holds the architecture notes, the tests and the CI described here,
                and <Code>/profile.json</Code> and <Code>/llms.txt</Code> publish the same facts for
                agents.
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
  id: SectionId;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  const index = sections.findIndex((section) => section.id === id);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-line py-12 first:border-t-0 first:pt-0 md:py-16"
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
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** Two stacked sheets: the page, peeled back to the layer beneath it. */
function Layers() {
  return (
    <svg
      aria-hidden
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
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
