import { ImageResponse } from 'next/og';
import { ogFonts } from '@/assets/fonts';
import { caseStudyPath, findCaseStudy } from '@/content/case-studies';
import { person, site } from '@/content/profile';
import { darkTokens as c } from '@/lib/tokens';

export { generateStaticParams } from './params';
export const dynamicParams = false;

// Static: generateImageMetadata could name each case study, but its images are not prerendered.
export const alt = `A case study by ${person.name}, ${person.role}: its title and lede on a dark card.`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const mono = { fontFamily: 'IBM Plex Mono', fontWeight: 500 } as const;

/** The home page's card, recast for one case study: its accent, number, title and lede. */
export default async function CaseStudyImage({ params }: { params: Promise<{ slug: string }> }) {
  const study = findCaseStudy((await params).slug);
  if (!study) throw new Error('Unknown case study');
  const { theme } = study;
  const accent = c[theme.accent];

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
      {/* The engineering grid, fading out from the top left, under a faint glow in the accent. */}
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
            <stop offset="0" stopColor={accent} stopOpacity="0.14" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
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
            Case study
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1000 }}>
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
                background: accent,
                // The accent at 16% alpha.
                boxShadow: `0 0 0 5px ${accent}29`,
              }}
            />
            <span style={{ color: accent }}>{theme.index}</span>
            {theme.kicker}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
              textWrap: 'balance',
            }}
          >
            {theme.title}
          </div>
          <div style={{ marginTop: 26, fontSize: 31, lineHeight: 1.4, color: c.muted }}>
            {theme.lede}
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
          <span style={{ color: c.fg }}>
            {site.domain}
            {caseStudyPath(study.id)}
          </span>
          <span>
            {person.name} · {person.shortRole}
          </span>
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
