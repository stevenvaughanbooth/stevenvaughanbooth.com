import { ArrivalFilm } from '@/components/film/arrival-film';
import { film } from '@/content/profile';

/** A short, optional pause between the work and the career: compact, and never in the way. */
export function Interlude() {
  return (
    <section id="film" aria-labelledby="film-title" className="reveal border-t border-line py-12">
      <div className="page grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-16">
        <div>
          <p className="label">
            {film.kicker} / {film.title}
          </p>
          <h2 id="film-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight">
            {film.heading}
          </h2>
          <p className="mt-3 text-lg text-muted">{film.body}</p>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-subtle">{film.note}</p>
        </div>
        <ArrivalFilm />
      </div>
    </section>
  );
}
