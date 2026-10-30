import type { Metadata, Viewport } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { AskLauncher } from '@/components/ask/ask-launcher';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { person, site } from '@/content/profile';
import { darkTokens, lightTokens, themeScript } from '@/lib/tokens';
import './globals.css';

const sans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
// One mono weight serves labels, code and timecodes, saving an 11 KB face on every page. It stays
// preloaded: a font first discovered in CSS is fetched at the highest priority, which Lighthouse
// models as render-blocking (mobile FCP went from 1.2 s to 1.5 s without the preload).
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s — ${person.name}` },
  description: site.description,
  applicationName: person.name,
  authors: [{ name: person.name, url: site.url }],
  creator: person.name,
  alternates: {
    canonical: '/',
    types: { 'application/json': '/profile.json' },
  },
  openGraph: {
    type: 'profile',
    siteName: person.name,
    title: site.title,
    description: site.description,
    firstName: person.givenName,
    lastName: person.familyName,
  },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: lightTokens.bg },
    { media: '(prefers-color-scheme: dark)', color: darkTokens.bg },
  ],
  colorScheme: 'light dark',
};

/** Speed Insights reports to Vercel's edge; off Vercel its client code is not even bundled. */
async function Analytics() {
  if (!process.env.SPEED_INSIGHTS) return null;
  const { SpeedInsights } = await import('@vercel/speed-insights/next');
  return <SpeedInsights />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Without a saved choice, CSS follows the system theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-fg px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <AskLauncher />
        <Analytics />
      </body>
    </html>
  );
}
