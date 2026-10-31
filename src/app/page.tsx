import { Contact } from '@/components/sections/contact';
import { Experience } from '@/components/sections/experience';
import { Hero } from '@/components/sections/hero';
import { OpenSource } from '@/components/sections/open-source';
import { Work } from '@/components/sections/work';
import { Signal } from '@/components/signal/signal';
import { jsonLd, serializeJsonLd } from '@/lib/structured-data';

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
