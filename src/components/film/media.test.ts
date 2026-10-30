import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickSource, poster, sceneAt, scenes, sources, timecode } from './media';

const publicDir = join(process.cwd(), 'public');

describe('film media', () => {
  it('prefers AV1 only when the browser is confident it can play it', () => {
    const browser = (av1: CanPlayTypeResult, h264: CanPlayTypeResult = 'probably') => ({
      canPlayType: (type: string) => (type.includes('av01') ? av1 : h264),
    });
    expect(pickSource(browser('probably'))).toBe(0);
    expect(pickSource(browser('maybe'))).toBe(1);
    expect(pickSource(browser(''))).toBe(1);
    expect(pickSource(browser('', ''))).toBe(sources.length - 1);
  });

  it('names every file by its content hash, since /film is cached immutably', () => {
    for (const { src } of [...sources, poster]) {
      const hash = src.match(/\.([0-9a-f]{8})\.\w+$/)?.[1];
      const bytes = readFileSync(join(publicDir, src));
      expect(createHash('sha256').update(bytes).digest('hex').slice(0, 8)).toBe(hash);
    }
  });

  it('ships no film file that nothing references', () => {
    const referenced = [...sources, poster].map(({ src }) => src.replace('/film/', ''));
    expect(readdirSync(join(publicDir, 'film')).sort()).toEqual(referenced.sort());
  });

  it('maps a time to its chapter', () => {
    expect(sceneAt(0)).toBe(scenes[0]);
    expect(sceneAt(2.45)).toBe(scenes[0]);
    expect(sceneAt(2.46)).toBe(scenes[1]);
    expect(sceneAt(99)).toBe(scenes.at(-1));
  });

  it('formats the timecode like the original intro', () => {
    expect(timecode(0)).toBe('00.0');
    expect(timecode(4.24)).toBe('04.2');
    expect(timecode(15.625)).toBe('15.6');
  });
});
