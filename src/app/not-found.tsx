import type { Metadata } from 'next';
import Link from 'next/link';
import { AskButton } from '@/components/ask/ask-button';
import { ArrowRight, Sparkle } from '@/components/ui/icons';
import { adage, careerStartYear, type SectionId, sections } from '@/content/profile';

// Next.js already marks not-found responses noindex.
export const metadata: Metadata = {
  title: 'Page not found',
};

const details: Partial<Record<SectionId, string>> = {
  'open-source': adage.name,
  work: 'Three ideas',
  experience: `Since ${careerStartYear}`,
  contact: 'Email first',
};

const links = sections.flatMap((section) => {
  const detail = details[section.id];
  return section.nav && detail ? [{ id: section.id, label: section.label, detail }] : [];
});

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl"
      />
      <div className="page pt-32 pb-20 md:pt-44 md:pb-28">
        <p className="label flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-amber" />
          Error 404 · Not found
        </p>
        <h1 id="not-found-title" className="mt-6 max-w-3xl text-title font-semibold text-balance">
          This page isn’t here. The rest of the site is one step away.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted">
          The link may be mistyped, or the page may have moved. Almost everything lives on the home
          page, and Ask Steven can point you to what you were looking for.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/" className="pill pill-solid">
            Back to home
          </Link>
          <AskButton className="pill pill-outline">
            <Sparkle /> Ask Steven
          </AskButton>
        </div>

        <nav aria-labelledby="not-found-sections" className="mt-16">
          <h2 id="not-found-sections" className="label">
            Or jump to a section
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4">
            {links.map((link) => (
              <li key={link.id} className="flex">
                <a
                  href={`/#${link.id}`}
                  className="group flex flex-1 items-start justify-between gap-2 bg-surface p-4 transition-colors hover:bg-elevated focus-visible:-outline-offset-4 sm:gap-3 sm:p-5 md:p-6"
                >
                  <span>
                    <span className="block font-medium">{link.label}</span>
                    <span className="mt-1 block font-mono text-xs text-subtle">{link.detail}</span>
                  </span>
                  <ArrowRight
                    width={16}
                    height={16}
                    className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
