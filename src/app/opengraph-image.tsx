import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ogFonts } from '@/assets/fonts';
import { person, site } from '@/content/profile';
import { darkTokens as c } from '@/lib/tokens';

export const alt = `${person.name}, ${person.role} at ${person.company}. ${person.about.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PORTRAIT = { width: 240, height: 300 };
const mono = { fontFamily: 'IBM Plex Mono', fontWeight: 500 } as const;

export default async function OpenGraphImage() {
  const [fonts, portrait] = await Promise.all([
    ogFonts(),
    readFile(join(process.cwd(), 'src/assets/headshot.jpeg'), 'base64'),
  ]);

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        background: c.bg,
        color: c.fg,
        fontFamily: 'DM Sans',
      }}
    >
      {/* The hero's engineering grid, fading out from the top left, under a faint green glow. */}
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0.5H0.5V48" fill="none" stroke={c.fg} strokeOpacity="0.06" />
          </pattern>
          <radialGradient id="fade" cx="0.3" cy="0" r="0.85">
            <stop offset="0.2" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="mask">
            <rect width="100%" height="100%" fill="url(#fade)" />
          </mask>
          <radialGradient id="glow" cx="0.22" cy="0" r="0.6">
            <stop offset="0" stopColor={c.green} stopOpacity="0.16" />
            <stop offset="1" stopColor={c.green} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#mask)" />
        <rect width="100%" height="100%" fill="url(#glow)" />
      </svg>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: '60px 72px 52px',
        }}
      >
        <div style={{ ...mono, display: 'flex', fontSize: 30, lineHeight: 1 }}>
          sb<span style={{ color: c.green }}>.</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                ...mono,
                fontSize: 19,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: c.subtle,
              }}
            >
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  background: c.green,
                  // The green token at 16% alpha.
                  boxShadow: `0 0 0 5px ${c.green}29`,
                }}
              />
              {person.role} · {person.company}
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 104,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: '-0.045em',
              }}
            >
              {person.name}
            </div>
            <div
              style={{
                marginTop: 28,
                fontSize: 31,
                lineHeight: 1.42,
                color: c.muted,
                textWrap: 'balance',
              }}
            >
              {person.headline}
            </div>
          </div>
          <img
            src={`data:image/jpeg;base64,${portrait}`}
            alt=""
            width={PORTRAIT.width}
            height={PORTRAIT.height}
            style={{ borderRadius: 24, border: `1px solid ${c.lineStrong}`, objectFit: 'cover' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 24,
            borderTop: `1px solid ${c.line}`,
            ...mono,
            fontSize: 21,
            color: c.subtle,
          }}
        >
          <span style={{ color: c.fg }}>{site.domain}</span>
          <span>{person.tagline}</span>
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
