import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { componentById, siteComponents } from './components';

// The ids both X-ray and How I built this rely on; data-component attributes use them.
const ids = [
  'site-header',
  'sections-menu',
  'theme-toggle',
  'ask-button',
  'xray-toggle',
  'site-footer',
  'shortcuts',
  'palette-loader',
  'ask-palette',
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
];

describe('the component manifest', () => {
  it('lists each component once, by the agreed ids', () => {
    expect(siteComponents.map((component) => component.id).sort()).toEqual([...ids].sort());
  });

  it('marks only what draws no box of its own as off the page', () => {
    const offPage = siteComponents.filter((component) => !component.onPage).map(({ id }) => id);
    expect(offPage.sort()).toEqual([
      'ask-palette',
      'case-study-focus',
      'palette-loader',
      'shortcuts',
    ]);
  });

  it('points every entry at a file in the repository, with a name, a kind and its reasons', () => {
    for (const component of siteComponents) {
      expect(existsSync(component.file), component.file).toBe(true);
      expect(component.name).toMatch(/^[A-Z][A-Za-z]+$/);
      expect(['server', 'client', 'css']).toContain(component.kind);
      expect(component.loads.length, component.id).toBeGreaterThan(0);
      expect(component.features.length, component.id).toBeGreaterThan(0);
      expect(component.why.length, component.id).toBeGreaterThan(0);
    }
  });

  it('finds a component by id, and nothing for an unknown one', () => {
    expect(componentById('hero')?.name).toBe('Hero');
    expect(componentById('signal')?.kind).toBe('css');
    expect(componentById('nope')).toBeUndefined();
  });
});
