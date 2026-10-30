// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const src = join(root, 'src');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, 'utf8');
const importsAskLib = (code: string) =>
  /from\s+['"](@\/lib\/ask|(\.\.\/)+lib\/ask)(\/|['"])/.test(code);
const isTest = (path: string) => /\.test\.tsx?$/.test(path);

describe('server-only boundary for Ask Steven', () => {
  it('no component imports src/lib/ask', () => {
    const offenders = sources(join(src, 'components'))
      .filter((path) => importsAskLib(read(path)))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });

  it('no client module anywhere imports src/lib/ask', () => {
    const offenders = sources(src)
      .filter((path) => /^\s*['"]use client['"]/.test(read(path)) && importsAskLib(read(path)))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });

  it('every src/lib/ask module is marked server-only', () => {
    const unmarked = sources(join(src, 'lib', 'ask'))
      .filter((path) => !isTest(path) && !/^import 'server-only';$/m.test(read(path)))
      .map((path) => relative(root, path));
    expect(unmarked).toEqual([]);
  });

  it('never exposes an Anthropic or Redis secret through a public environment variable', () => {
    const files = [
      ...sources(src),
      join(root, 'next.config.ts'),
      join(root, 'instrumentation-client.ts'),
    ];
    const offenders = files
      .filter((path) => /NEXT_PUBLIC_[A-Z_]*(ANTHROPIC|API_KEY|KV_|UPSTASH|REDIS)/.test(read(path)))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });
});
