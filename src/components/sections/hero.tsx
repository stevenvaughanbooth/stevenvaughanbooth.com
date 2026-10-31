import { getImageProps } from 'next/image';
import Link from 'next/link';
import headshot from '@/assets/headshot.jpeg';
import { HeroAsk } from '@/components/ask/hero-ask';
import { Arrival } from '@/components/film/arrival';
import { signalOrigin } from '@/components/signal/signal';
import { ArrowRight, GitHub, LinkedIn, Mail } from '@/components/ui/icons';
import { highlights, person } from '@/content/profile';

export function Hero() {
  // A plain <img> rendered on the server: the hero ships no image JavaScript. Below md the
  // portrait is an 88px avatar beside the name; from md it fills a column capped at 340px. It is
  // the frame's resting image, painted first; the film opens over it only once the page settles.
  const { props: portrait } = getImageProps({
    src: headshot,
    alt: `Portrait of ${person.name}`,
    sizes: '(min-width: 1024px) 340px, (min-width: 768px) 240px, 88px',
    loading: 'eager',
    fetchPriority: 'high',
  });

  return (
    <section
      data-component="hero"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden"
    >
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -z-10 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl"
      />
      {/*
       * Below md the text column's wrapper is display:contents, so the name and the avatar share
       * a row of the outer grid. From md the wrapper is an ordinary column beside the portrait:
       * name, tagline, the ask bar and the contact links, balanced against the frame.
       */}
      <div className="page grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-4 pt-24 pb-16 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-x-12 md:pt-32 md:pb-20 lg:grid-cols-[minmax(0,1fr)_21.25rem] lg:gap-x-14">
        <div className="contents md:block">
          <p className="label col-span-2 flex items-center gap-2">
            <span className={`${signalOrigin} relative flex size-2`}>
              <span className="absolute inline-flex size-full animate-[ping_1s_cubic-bezier(0,0,0.2,1)_3] rounded-full bg-green opacity-50 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-green" />
            </span>
            {person.role} · {person.company}
          </p>
          <h1
            id="hero-title"
            className="col-start-2 row-start-2 mt-4 text-display font-semibold md:mt-6"
          >
            {person.name}
          </h1>
          <p className="col-span-2 mt-6 max-w-xl text-xl leading-relaxed text-pretty text-muted md:text-2xl">
            {person.headline}
          </p>
          <HeroAsk className="col-span-2 mt-8" />
          <div className="col-span-2 mt-6 flex flex-wrap items-center gap-3">
            <a href={person.links.email} className="pill pill-solid">
              <Mail /> Email me
            </a>
            {/* The two profile links wrap together, never one alone on a row. */}
            <div className="flex gap-1">
              <a href={person.links.github} className="pill pill-ghost">
                <GitHub /> GitHub
              </a>
              <a href={person.links.linkedin} className="pill pill-ghost">
                <LinkedIn /> LinkedIn
              </a>
            </div>
          </div>
        </div>

        <Arrival
          // eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies the optimized srcset
          portrait={<img {...portrait} alt={portrait.alt} className="size-full object-cover" />}
          className="col-start-1 row-start-2 mt-4 size-22 md:col-start-2 md:row-start-1 md:mt-0 md:aspect-[4/5] md:h-auto md:w-full"
        />

        <ProofStrip />
        {/* A quiet way into the story of how the site was built, for readers who came for that. */}
        <p className="col-span-2 mt-4 md:mt-5">
          {/* No prefetch: in view, it would preload Under the hood's stylesheet on every visit to
              the home page, and the browser would warn that it went unused. */}
          <Link
            href="/colophon"
            prefetch={false}
            className="group inline-flex min-h-6 items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-fg"
          >
            Under the hood
            <ArrowRight
              width={14}
              height={14}
              className="text-green transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * The proof strip spans both columns, under the text and the portrait, so the two above it
 * balance. Each term is the figure and its description the context, so each is read once.
 */
function ProofStrip() {
  return (
    <dl
      data-component="proof-strip"
      className="col-span-2 mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:mt-16 lg:grid-cols-4"
    >
      {highlights.map((item) => (
        <div key={item.value} className="bg-bg p-4 md:p-5">
          <dt className="text-xl font-semibold tracking-tight md:text-2xl">{item.value}</dt>
          <dd className="mt-1 text-sm leading-snug text-muted">{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}
