import { Contact } from '@/components/sections/contact';
import { Experience } from '@/components/sections/experience';
import { Hero } from '@/components/sections/hero';
import { Interlude } from '@/components/sections/interlude';
import { OpenSource } from '@/components/sections/open-source';
import { Work } from '@/components/sections/work';
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
      <Interlude />
      <Experience />
      <Contact />
    </>
  );
}
