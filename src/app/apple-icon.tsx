import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { darkTokens as c } from '@/lib/tokens';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** The favicon's "sb." outlines on a full-bleed tile: iOS applies its own rounded mask. */
export default async function AppleIcon() {
  const favicon = await readFile(join(process.cwd(), 'src/app/icon.svg'), 'utf8');
  const [letters, dot] = Array.from(favicon.matchAll(/ d="([^"]+)"/g), (match) => match[1]);

  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: c.bg }}>
      <svg width={size.width} height={size.height} viewBox="0 0 32 32">
        <path d={letters} fill={c.fg} />
        <path d={dot} fill={c.green} />
      </svg>
    </div>,
    size,
  );
}
