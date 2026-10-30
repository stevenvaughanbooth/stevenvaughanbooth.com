import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';
const isPreview = process.env.VERCEL_ENV === 'preview';

/*
 * Everything the site loads in production is same-origin: pages, next/og images, self-hosted
 * fonts, the film, Vercel Speed Insights (/_vercel/speed-insights/*), BotID's proxied challenge,
 * and /api/ask. Next.js streams its RSC payload through inline scripts, so a nonce-free static
 * site needs 'unsafe-inline' for scripts; React style attributes need it for styles. That leaves
 * an injected <script> element unblocked, but inline event-handler attributes (onerror=, onclick=)
 * are refused by script-src-attr: React attaches handlers in JavaScript, never as attributes.
 */
const directives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'script-src-attr': ["'none'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  // data: covers next/image blur placeholders.
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'media-src': ["'self'"],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

// Development: React's debugging needs eval, and Speed Insights loads its debug script from its CDN.
if (isDev) {
  directives['script-src']?.push("'unsafe-eval'", 'https://va.vercel-scripts.com');
}

// Preview deployments only: the Vercel Toolbar (https://vercel.com/docs/vercel-toolbar/managing-toolbar).
if (isPreview) {
  directives['script-src']?.push('https://vercel.live');
  directives['style-src']?.push('https://vercel.live');
  directives['img-src']?.push('https://vercel.live', 'https://vercel.com', 'blob:');
  directives['font-src']?.push('https://vercel.live', 'https://assets.vercel.com');
  directives['connect-src']?.push('https://vercel.live', 'wss://ws-us3.pusher.com');
  directives['frame-src'] = ["'self'", 'https://vercel.live'];
}

const contentSecurityPolicy = [
  ...Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(' ')}`),
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next's dev server otherwise writes an AGENTS.md into the repo root on every run.
  agentRules: false,
  typedRoutes: true,
  poweredByHeader: false,
  // Inlined at build time, so the layout's Speed Insights import is dead code (and not bundled)
  // off Vercel, where its script would 404 anyway.
  env: { SPEED_INSIGHTS: process.env.VERCEL ? 'on' : '' },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/film/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

// withBotId appends its own header rule for the challenge paths (frame-ancestors 'self'), which
// overrides the global X-Frame-Options and CSP there, so BotID can frame its same-origin challenge.
export default withBotId(nextConfig);
