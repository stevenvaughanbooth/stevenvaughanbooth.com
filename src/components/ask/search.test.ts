import { describe, expect, it } from 'vitest';
import { sections } from '@/content/profile';
import { isPageTargetId } from '@/lib/page-targets';
import { goToItems } from './palette-items';
import { fuzzyScore, looksLikeQuestion, search } from './search';

describe('search', () => {
  it('lists featured topics, every section and every link before anything is typed', () => {
    const results = search('');
    expect(results.groups.map((group) => group.label)).toEqual(['Topics', 'Go to', 'Links']);
    expect(results.defaultKey).toBe(results.options[0]?.key);
    // Derived from the shared section list, so it can't point at a section that isn't there.
    expect(goToItems.map((item) => item.href)).toEqual([
      ...sections.filter((section) => isPageTargetId(section.id)).map(({ id }) => `/#${id}`),
      '/colophon',
    ]);
  });

  it('no longer offers the film section, which now plays in the hero', () => {
    expect(goToItems.map((item) => item.id)).not.toContain('film');
    expect(search('film').options.map((option) => option.key)).not.toContain('go:film');
  });

  it('always offers to ask, first', () => {
    const results = search('zzqx');
    expect(results.groups.map((group) => group.id)).toEqual(['ask']);
    expect(results.defaultKey).toBe('ask');
  });

  it.each([
    ['github', 'link:github'],
    ['linkedin', 'link:linkedin'],
    ['email', 'link:email'],
    ['copy', 'link:copy-email'],
    ['work', 'go:work'],
    ['contact', 'go:contact'],
    ['colophon', 'go:colophon'],
    ['adage', 'topic:adage'],
    ['mcp', 'topic:mcp'],
    ['career', 'topic:career'],
    ['core metadata platform', 'topic:platform'],
  ])('jumps straight to the best match for “%s”', (query, key) => {
    expect(search(query).defaultKey).toBe(key);
  });

  it('sends questions to Ask while still suggesting matching topics', () => {
    const results = search('How do you design APIs for agents?');
    expect(results.defaultKey).toBe('ask');
    const topics = results.groups.find((group) => group.id === 'topics');
    expect(topics?.options[0]).toMatchObject({ kind: 'topic', topic: { id: 'mcp' } });
  });

  it('matches partial and loosely typed words', () => {
    const keys = search('plat').options.map((option) => option.key);
    expect(keys).toContain('topic:platform');
    expect(search('timeline').options.map((option) => option.key)).toContain('go:experience');
    expect(fuzzyScore('recog', 'Recognition')).toBeGreaterThan(0);
    expect(fuzzyScore('expr', 'Experience')).toBeGreaterThan(0);
    expect(fuzzyScore('go to work', 'Work')).toBeGreaterThan(0);
    expect(fuzzyScore('banana', 'Work')).toBe(0);
  });

  it('recognizes questions, and requests to be shown something', () => {
    expect(looksLikeQuestion('What is Adage?')).toBe(true);
    expect(looksLikeQuestion('show me adage')).toBe(true);
    expect(search('take me to the awards').defaultKey).toBe('ask');
    expect(looksLikeQuestion('tell me about mcp')).toBe(true);
    expect(looksLikeQuestion('adage')).toBe(false);
    expect(looksLikeQuestion('core metadata platform')).toBe(false);
  });
});
