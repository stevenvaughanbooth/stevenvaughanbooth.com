import { pipelineLabelId } from './view';

const lit = 'transition-colors duration-500 group-data-looping/reflex:text-green';
const loopLine = `border-line-strong text-line-strong group-data-looping/reflex:border-green/60 ${lit}`;

const arrowProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Where later sessions loop back to, as the pipeline and the 3D scene label it. */
export const laterSessions = 'later sessions';

/**
 * Adage's pipeline from the README, with the loop from step 4 back to step 2: a row of four where
 * the stage is short and wide, two by two where it is narrow or tall (a medium card, whose stage is
 * twice as wide as it is tall for the 3D scene, would otherwise hold a thin row in an empty box). Rendered once, on the server, inside the stage the 3D
 * scene draws over (see ReflexDemoView). The card's `data-matched` lights the last step while
 * the reflex shows, and `data-looping` lights the loop once the session is over.
 */
export function Pipeline({ id, stages }: { id: string; stages: readonly string[] }) {
  const labelId = pipelineLabelId(id);
  return (
    <div className="w-full">
      <div className="relative pr-6 @sm:pr-0 @sm:pb-9 @md:pr-8 @md:pb-0 @3xl:pr-0 @3xl:pb-9">
        <ol
          aria-labelledby={labelId}
          className="grid grid-cols-2 gap-3 @sm:grid-cols-4 @md:grid-cols-2 @md:gap-x-5 @md:gap-y-4 @3xl:grid-cols-4 @3xl:gap-3"
        >
          {stages.map((stage, i) => {
            const last = i === stages.length - 1;
            return (
              <li
                key={stage}
                className={`relative rounded-lg border border-line bg-surface px-2.5 py-2 text-muted transition-colors duration-500 @sm:px-2 @md:px-4 @md:py-4 @3xl:px-2.5 @3xl:py-2 ${last ? 'group-data-matched/reflex:border-green/50 group-data-matched/reflex:bg-green/[0.07] group-data-matched/reflex:text-fg' : ''}`}
              >
                <span
                  aria-hidden
                  className={`flex items-center gap-1.5 font-mono text-micro text-subtle ${last ? 'group-data-matched/reflex:text-muted' : ''}`}
                >
                  {String(i + 1).padStart(2, '0')}
                  {last ? (
                    <span className="size-1.5 rounded-full bg-green opacity-0 transition-opacity forced-color-adjust-none group-data-matched/reflex:opacity-100 forced-colors:bg-[Highlight]" />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-pretty @sm:text-micro @md:text-sm @3xl:text-xs">
                  {stage}
                </span>
                {last ? null : (
                  // Two by two, step 2 ends a row: the next step starts the row below.
                  // The arrows sit in the gap between steps, which is wider on a medium card.
                  <svg
                    aria-hidden
                    viewBox="0 0 12 8"
                    className={`absolute top-1/2 -right-3 h-2 w-3 -translate-y-1/2 text-subtle @md:-right-4 @3xl:-right-3 ${i === 1 ? '@max-sm:hidden @md:@max-3xl:hidden' : ''}`}
                    {...arrowProps}
                  >
                    <path d="M2.5 4h7M7 1.5 9.5 4 7 6.5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
        <p className="sr-only">Later sessions loop back to step 2.</p>

        {/* Two by two: up the right side, from step 4 back to step 2. */}
        <div
          aria-hidden
          className={`absolute top-1/4 right-1 bottom-1/4 w-3.5 rounded-r-lg border-y border-r @sm:hidden @md:block @md:w-5 @3xl:hidden ${loopLine}`}
        >
          <svg
            viewBox="0 0 6 8"
            className="absolute -top-[4.5px] -left-[3px] h-2 w-1.5"
            {...arrowProps}
          >
            <path d="M4.5 1 1.5 4l3 3" />
          </svg>
        </div>

        {/* In a row: under the steps, from step 4's centre back to step 2's (offsets account for the 0.75rem gaps). */}
        <div
          aria-hidden
          className={`absolute right-[calc(12.5%-0.28rem)] bottom-2 left-[calc(37.5%-0.09rem)] hidden h-7 rounded-b-lg border-x border-b @sm:block @md:hidden @3xl:block ${loopLine}`}
        >
          <svg
            viewBox="0 0 10 6"
            className="absolute -top-px -left-[5.5px] h-1.5 w-2.5"
            {...arrowProps}
          >
            <path d="M1 5.5 5 1l4 4.5" />
          </svg>
          <span
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-bg px-2 font-mono text-micro whitespace-nowrap text-subtle ${lit}`}
          >
            ↺ {laterSessions}
          </span>
        </div>
      </div>
      <p
        aria-hidden
        className={`mt-1.5 text-right font-mono text-micro text-subtle @sm:hidden @md:mt-3 @md:block @3xl:hidden ${lit}`}
      >
        ↺ {laterSessions}
      </p>
    </div>
  );
}
