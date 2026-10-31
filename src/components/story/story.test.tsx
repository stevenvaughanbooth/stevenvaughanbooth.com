import { render, screen, within } from '@testing-library/react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentById, siteComponents } from '@/content/components';
import lighthouse from '../../../lighthouserc.json';
import { componentGroups, mappedIds } from './component-groups';
import { cardId, ComponentMap, KindLegend, kindLabel } from './component-map';
import {
  fraction,
  homeMeasurement,
  kilobytes,
  measured,
  measuredOn,
  milliseconds,
  otherCategories,
  seconds,
} from './measured';
import { ReactIdeas, reactIdeas } from './react-ideas';
import { Results } from './results';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/** Every file under `dir`, by its path from the repository, to find the islands a component lists. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe('siteComponents', () => {
  it('has exactly the ids X-ray mode and this page share, once each', () => {
    expect(siteComponents.map((component) => component.id)).toEqual([
      'site-header',
      'sections-menu',
      'theme-toggle',
      'ask-button',
      'xray-toggle',
      'site-footer',
      'shortcuts',
      'shortcuts-sheet',
      'xray-overlay',
      'palette-loader',
      'ask-palette',
      'error-boundary',
      'hero',
      'hero-ask-bar',
      'arrival',
      'proof-strip',
      'open-source',
      'reflex-demo',
      'copy-button',
      'count-up',
      'work',
      'team-multiplier',
      'progressive-disclosure',
      'metadata-platform',
      'experience',
      'career-timeline',
      'contact',
      'signal',
      'case-study',
      'case-study-focus',
      'colophon',
    ]);
    expect(componentById('arrival')?.name).toBe('Arrival');
    expect(componentById('nope')).toBeUndefined();
  });

  it('marks only the listeners and the lazily opened dialogs as having no box of their own', () => {
    expect(siteComponents.filter((c) => !c.onPage).map((c) => c.id)).toEqual([
      'shortcuts',
      'shortcuts-sheet',
      'xray-overlay',
      'palette-loader',
      'ask-palette',
      'error-boundary',
      'case-study-focus',
    ]);
  });

  it('names a real file for each, and calls it client only when it runs in the browser', () => {
    const saysUseClient = (source: string) => /^'use client';/.test(source);
    // Client modules that load others on demand: a module they import() is client code too.
    const loaders = siteComponents
      .filter((component) => component.kind === 'client')
      .map((component) => read(component.file))
      .filter(saysUseClient);
    for (const component of siteComponents) {
      const source = read(component.file);
      const name = component.file
        .split('/')
        .at(-1)!
        .replace(/\.tsx?$/, '');
      const loaded = loaders.some((loader) => loader.includes(`import('./${name}')`));
      expect(saysUseClient(source) || loaded, component.id).toBe(component.kind === 'client');
    }
  });

  it('lists islands only for server components, and each one is a real module', () => {
    // An island is named by its path under src/components, or by its file name if that is unique.
    const files = filesUnder('src/components');
    const real = (island: string) =>
      island.includes('/')
        ? existsSync(join(process.cwd(), 'src/components', island))
        : files.filter((file) => file.endsWith(`/${island}`)).length === 1;
    for (const component of siteComponents) {
      if (!component.islands) continue;
      expect(component.kind, component.id).toBe('server');
      for (const island of component.islands) expect(real(island), island).toBe(true);
    }
  });

  it('gives every component a load time, features and a why of one or two sentences', () => {
    for (const component of siteComponents) {
      expect(component.loads, component.id).not.toBe('');
      expect(component.features.length, component.id).toBeGreaterThan(0);
      const sentences = component.why.split(/(?<=[.!?])\s+(?=[A-Z<“#])/);
      expect(sentences.length, component.id).toBeLessThanOrEqual(2);
      // Client code always loads at some point; only server and CSS components can ship none.
      if (component.loads === 'No JavaScript') expect(component.kind).not.toBe('client');
    }
  });
});

describe('ComponentMap', () => {
  it('places every component exactly once', () => {
    const ids = mappedIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(siteComponents.map((component) => component.id).sort());
  });

  it('is one sheet per group, each named by its heading and holding its components', () => {
    render(<ComponentMap />);
    for (const group of componentGroups) {
      const sheet = screen.getByRole('region', { name: group.title });
      expect(sheet).toHaveTextContent(group.where);
      for (const node of group.tree) {
        expect(sheet.querySelector(`#${cardId(node.id)}`)).not.toBeNull();
      }
    }
  });

  it('shows each component’s name, kind, file, load time and features', () => {
    const { container } = render(<ComponentMap />);
    for (const component of siteComponents) {
      const card = container.querySelector<HTMLElement>(`#${cardId(component.id)}`)!;
      // The brackets are for the eye: the card is named by the component alone.
      expect(card).toHaveAccessibleName(component.name);
      const heading = within(card).getAllByRole('heading')[0]!;
      expect(heading).toHaveTextContent(`<${component.name} />`);
      expect(card).toHaveTextContent(kindLabel[component.kind]);
      expect(card).toHaveTextContent(component.file);
      expect(card).toHaveTextContent(component.loads);
      expect(card).toHaveTextContent(component.why);
      const features = within(card).getAllByRole('list', { name: 'Features' })[0]!;
      expect(
        within(features)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([...component.features]);
    }
  });

  it('draws the components a component renders inside its card', () => {
    const { container } = render(<ComponentMap />);
    // The children's rows follow their parent's, in a list inside the parent's item.
    const hero = container.querySelector(`#${cardId('hero')}`)!.closest('li')!;
    const inside = within(hero).getByRole('list', { name: 'Inside Hero' });
    for (const id of ['hero-ask-bar', 'arrival', 'proof-strip'] as const) {
      expect(inside.querySelector(`#${cardId(id)}`)).not.toBeNull();
    }
    // Real components carry data-component; the cards that describe them must not.
    expect(container.querySelector('[data-component]')).toBeNull();
  });

  it('counts each kind in the legend, adding up to the whole list', () => {
    render(<KindLegend />);
    const counts = screen
      .getAllByRole('term')
      .map((term) => Number(term.textContent?.match(/\d+/)));
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(siteComponents.length);
  });
});

describe('ReactIdeas', () => {
  it('links each idea only to components that list what it is about', () => {
    for (const idea of reactIdeas) {
      for (const id of idea.uses) {
        const features = componentById(id)?.features ?? [];
        expect(
          features.some((feature) => idea.features.includes(feature)),
          `${idea.title}: ${id}`,
        ).toBe(true);
      }
    }
  });

  it('says the compiler covers the client components, which all list it, and nothing else does', () => {
    for (const component of siteComponents) {
      expect(component.features.includes('React Compiler'), component.id).toBe(
        component.kind === 'client',
      );
    }
  });

  it('points every link at a card on the map', () => {
    const { container } = render(
      <>
        <ReactIdeas />
        <ComponentMap />
      </>,
    );
    const links = [...container.querySelectorAll<HTMLAnchorElement>('ol a[href^="#"]')];
    expect(links).toHaveLength(reactIdeas.reduce((sum, idea) => sum + idea.uses.length, 0));
    for (const link of links) {
      expect(container.querySelector(link.getAttribute('href')!), link.href).not.toBeNull();
    }
  });
});

describe('measured', () => {
  it('formats each figure the way the page shows it', () => {
    expect(seconds(2.93)).toBe('2.93 s');
    expect(seconds(1.2)).toBe('1.20 s');
    expect(milliseconds(21)).toBe('21 ms');
    expect(kilobytes(162_659)).toBe('159 KB');
    expect(fraction(95)).toBe('0.95');
    expect(measuredOn('2026-10-30')).toBe('30 October 2026');
  });

  it('shows one value when the other categories agree, and all three when they do not', () => {
    expect(otherCategories(homeMeasurement)).toBe(String(homeMeasurement.accessibility));
    expect(
      otherCategories({ ...homeMeasurement, accessibility: 100, bestPractices: 96, seo: 100 }),
    ).toBe('100 · 96 · 100');
  });

  it('has a run for every page Lighthouse CI audits, dated with a real date', () => {
    const audited = lighthouse.ci.collect.url.map((url) => new URL(url).pathname);
    expect(measured.pages.map((page) => page.path)).toEqual(audited);
    expect(Number.isNaN(Date.parse(measured.date))).toBe(false);
  });

  it('asserts every budget on the median run, as Under the hood says', () => {
    const assertions: Record<string, unknown[]> = lighthouse.ci.assert.assertions;
    for (const [id, [, options]] of Object.entries(assertions)) {
      expect((options as { aggregationMethod?: string }).aggregationMethod, id).toBe('median-run');
    }
  });
});

describe('Under the hood', () => {
  it('names the model the route handler calls', () => {
    const model = /const MODEL = '([^']+)'/.exec(read('src/lib/ask/answer.ts'))?.[1];
    expect(model).toBeDefined();
    expect(read('src/app/colophon/page.tsx')).toContain(`version: '${model}'`);
  });
});

describe('Results', () => {
  it('reads its figures from measured.ts and its floor from the caller', () => {
    render(<Results floor={0.9} detailsHref="#budgets" />);
    const tiles = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(tiles).toEqual([
      String(homeMeasurement.performance),
      otherCategories(homeMeasurement),
      String(measured.tests.unit),
      String(measured.tests.e2e.passed),
    ]);
    const caveat = screen.getByRole('region', { name: 'The caveat' });
    expect(caveat).toHaveTextContent('So CI enforces a floor of 0.90');
    expect(within(caveat).getByRole('link')).toHaveAttribute('href', '#budgets');
  });

  it('shows the CI range only beside the local score measured in the same round', () => {
    render(<Results floor={0.9} detailsHref="#budgets" />);
    const { round, low, high, localThen } = measured.ciRunners;
    const caveat = screen.getByRole('region', { name: 'The caveat' });
    expect(caveat).toHaveTextContent(
      `On GitHub’s runners in ${round}, Lighthouse scored the home page ${low.toFixed(2)} to ${high.toFixed(2)}, where my local build scored ${fraction(localThen)}.`,
    );
    // Today's home score is a different run: if it differs, it must not appear beside the range.
    if (homeMeasurement.performance !== localThen) {
      expect(caveat).not.toHaveTextContent(fraction(homeMeasurement.performance));
    }
  });
});
