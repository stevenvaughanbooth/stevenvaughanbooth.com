import type { Metadata } from 'next';
import { Contact } from '@/components/sections/contact';
import { Experience } from '@/components/sections/experience';
import { Hero } from '@/components/sections/hero';
import { OpenSource } from '@/components/sections/open-source';
import { Work } from '@/components/sections/work';
import { Signal } from '@/components/signal/signal';
import { person, site } from '@/content/profile';
import { jsonLd, serializeJsonLd } from '@/lib/structured-data';

// The layout's alternates are replaced, not merged, so the JSON profile is named again here.
export const metadata: Metadata = {
  alternates: { canonical: '/', types: { 'application/json': '/profile.json' } },
  openGraph: {
    type: 'profile',
    url: '/',
    siteName: person.name,
    title: site.title,
    description: site.description,
    firstName: person.givenName,
    lastName: person.familyName,
  },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Hero />
      <OpenSource />
      <Work />
      <Experience />
      <Contact />
      {/* The signal line runs from the hero to Contact: after both, so its anchors come first. */}
      <Signal />
    </>
  );
}
