import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sections } from '@/content/profile';
import { readingStyle, readingTimeline } from './reading';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const nav = sections.filter((section) => section.nav);
const scope = css
  .match(/body \{\s*timeline-scope:([^;]+);/)?.[1]
  ?.split(',')
  .map((name) => name.trim());

describe('reading marks', () => {
  it('have a view timeline in globals.css for every nav section, in scope for the header', () => {
    for (const { id } of nav) {
      const declared = css.match(new RegExp(`#${id} \\{\\s*view-timeline-name: ([^;]+);`));
      expect(
        declared?.[1]?.split(',').map((name) => name.trim()),
        `#${id}`,
      ).toContain(readingTimeline(id));
      expect(scope, 'timeline-scope').toContain(readingTimeline(id));
    }
  });

  it('let the last nav section take over at the end of the page', () => {
    const last = nav.at(-1)!;
    const declared = css.match(new RegExp(`#${last.id} \\{\\s*view-timeline-name: ([^;]+);`));
    expect(declared?.[1]).toContain('--read-end');
    expect(scope).toContain('--read-end');
  });

  it('name each nav item’s section timeline for its marks', () => {
    expect(readingStyle('work')).toEqual({ '--reading': '--read-work' });
  });
});
