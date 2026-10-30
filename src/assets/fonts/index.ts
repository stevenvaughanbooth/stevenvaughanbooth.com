import type { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'];

/*
 * TTF files for next/og images (Satori cannot read WOFF2), read from disk at build time.
 * DM Sans: static 400/600 instances (opsz 14) cut from the google/fonts variable font and subset
 * to Latin. IBM Plex Mono Medium: unmodified from google/fonts. Both are OFL; licenses alongside.
 */
const dir = join(process.cwd(), 'src/assets/fonts');

export async function ogFonts(): Promise<Fonts> {
  const [regular, semibold, mono] = await Promise.all([
    readFile(join(dir, 'DMSans-Regular.ttf')),
    readFile(join(dir, 'DMSans-SemiBold.ttf')),
    readFile(join(dir, 'IBMPlexMono-Medium.ttf')),
  ]);
  return [
    { name: 'DM Sans', data: regular, weight: 400, style: 'normal' },
    { name: 'DM Sans', data: semibold, weight: 600, style: 'normal' },
    { name: 'IBM Plex Mono', data: mono, weight: 500, style: 'normal' },
  ];
}
