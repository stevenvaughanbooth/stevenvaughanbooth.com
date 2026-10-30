import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkTokens, lightTokens } from './tokens';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('colour tokens', () => {
  const css = read('src/app/globals.css');

  it('match the light-dark() pairs in globals.css', () => {
    for (const name of Object.keys(lightTokens) as (keyof typeof lightTokens)[]) {
      const pair = css.match(new RegExp(`--${kebab(name)}: light-dark\\((#\\w+), (#\\w+)\\);`));
      expect(pair, `--${kebab(name)} in globals.css`).not.toBeNull();
      expect([pair?.[1], pair?.[2]], name).toEqual([lightTokens[name], darkTokens[name]]);
    }
  });

  it('define each colour once in the stylesheet', () => {
    expect(css.match(/#[0-9a-f]{6}\b/gi)).toHaveLength(Object.keys(lightTokens).length * 2);
  });

  it('cover the favicon colours, which a static SVG has to restate', () => {
    const icon = read('src/app/icon.svg');
    const palette: string[] = Object.values(darkTokens);
    for (const hex of icon.match(/#[0-9a-f]{6}\b/gi) ?? []) expect(palette).toContain(hex);
  });
});
