import { ImageResponse } from 'next/og';
import { ogFonts } from '@/assets/fonts';
import { type ComponentKind, siteComponents } from '@/content/components';
import { person, site } from '@/content/profile';
import { darkTokens as c } from '@/lib/tokens';

export const alt = `Under the hood: the React components behind ${person.name}’s site, counted by where they render, on a dark card.`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const mono = { fontFamily: 'IBM Plex Mono', fontWeight: 500 } as const;

/** The page's kind badges, in the colors the component map gives them. */
const kinds: { kind: ComponentKind; label: string; color: string }[] = [
  { kind: 'server', label: 'Server', color: c.green },
  { kind: 'client', label: 'Client', color: c.amber },
  { kind: 'css', label: 'CSS only', color: c.lilac },
];

/** The site's card, recast for Under the hood: its title, what it covers, and the components. */
export default async function ColophonImage() {
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
      {/* The component map's blueprint grid, fading out from the top left, under a blue glow. */}
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <pattern id="minor" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0.5H0.5V16" fill="none" stroke={c.blue} strokeOpacity="0.07" />
          </pattern>
          <pattern id="major" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="M96 0.5H0.5V96" fill="none" stroke={c.blue} strokeOpacity="0.14" />
          </pattern>
          <radialGradient id="fade" cx="0.3" cy="0" r="0.9">
            <stop offset="0.2" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="mask">
            <rect width="100%" height="100%" fill="url(#fade)" />
          </mask>
          <radialGradient id="glow" cx="0.22" cy="0" r="0.6">
            <stop offset="0" stopColor={c.blue} stopOpacity="0.14" />
            <stop offset="1" stopColor={c.blue} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#minor)" mask="url(#mask)" />
        <rect width="100%" height="100%" fill="url(#major)" mask="url(#mask)" />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...mono, display: 'flex', fontSize: 30, lineHeight: 1 }}>
            sb<span style={{ color: c.green }}>.</span>
          </div>
          <div
            style={{
              ...mono,
              display: 'flex',
              fontSize: 18,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: c.subtle,
              padding: '6px 14px',
              border: `1px solid ${c.line}`,
              borderRadius: 999,
            }}
          >
            Colophon
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1000 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: '-0.045em',
            }}
          >
            Under the hood
          </div>
          <div style={{ marginTop: 26, fontSize: 31, lineHeight: 1.4, color: c.muted }}>
            The React components this site is made of, when each one’s code loads, and why.
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 34 }}>
            {kinds.map(({ kind, label, color }) => (
              <div
                key={kind}
                style={{
                  ...mono,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 20,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color,
                  padding: '8px 16px',
                  border: `1px solid ${color}59`,
                  borderRadius: 999,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                {label}
                <span style={{ color: c.fg }}>
                  {siteComponents.filter((component) => component.kind === kind).length}
                </span>
              </div>
            ))}
          </div>
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
          <span style={{ color: c.fg }}>{site.domain}/colophon</span>
          <span>
            {person.name} · {person.role}
          </span>
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
