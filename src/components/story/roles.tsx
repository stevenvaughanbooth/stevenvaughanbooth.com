import { ArrowDown } from '@/components/ui/icons';
import { roles, type Who, who } from './story';

/**
 * Who did what, as two cards and the hand-offs between them. Below lg the cards stack and the
 * hand-offs point down and up; from lg they sit side by side and the hand-offs point across.
 * Plain HTML, read in order: my card, what passes each way, Claude Code's card.
 */
export function Roles() {
  return (
    <figure aria-labelledby="roles-caption">
      <figcaption id="roles-caption" className="label">
        Who did what
      </figcaption>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.75fr)] lg:gap-0">
        <RoleCard id="me" />

        <ul className="flex justify-center gap-x-8 gap-y-2 py-1 lg:flex-col lg:gap-7 lg:px-3 lg:py-0">
          {roles.handoffs.map((handoff) => {
            const back = handoff.to === 'me';
            return (
              <li
                key={handoff.what}
                className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-1.5"
              >
                <ArrowDown
                  width={16}
                  height={16}
                  className={`shrink-0 text-subtle lg:hidden ${back ? 'rotate-180' : ''}`}
                />
                <span className="font-mono text-micro tracking-wide text-muted uppercase lg:text-center">
                  <span className="sr-only">
                    From {who[handoff.from].label} to {who[handoff.to].label}:{' '}
                  </span>
                  {handoff.what}
                </span>
                <span
                  aria-hidden
                  className={`hidden items-center text-line-strong lg:flex ${back ? 'flex-row-reverse' : ''}`}
                >
                  <span className="h-px flex-1 bg-current" />
                  <svg
                    viewBox="0 0 6 10"
                    className={`h-2.5 w-1.5 fill-current ${back ? 'rotate-180' : ''}`}
                  >
                    <path d="M0 0 6 5 0 10Z" />
                  </svg>
                </span>
              </li>
            );
          })}
        </ul>

        <RoleCard id="claude" />
      </div>
    </figure>
  );
}

/** A side of the work: who, what they did, then their stages, kept level across both cards. */
function RoleCard({ id }: { id: Who }) {
  const role = roles[id];
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
      <p className="label flex items-center gap-2">
        <span aria-hidden className={`size-2 rounded-full ${who[id].dot}`} />
        {who[id].label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{role.name}</p>
      <ul className="mt-4 space-y-2">
        {role.jobs.map((job) => (
          <li key={job} className="flex gap-3 leading-snug text-pretty">
            <span aria-hidden className="font-mono text-green">
              →
            </span>
            <span>{job}</span>
          </li>
        ))}
      </ul>
      <ol
        aria-label={role.stagesLabel}
        className={`mt-auto grid gap-2 pt-5 sm:gap-4 ${role.stages.length > 1 ? 'sm:grid-cols-3' : ''}`}
      >
        {role.stages.map((stage) => (
          <li
            key={stage.name}
            className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2 rounded-xl border border-line bg-elevated/60 px-3.5 py-2.5 sm:block sm:px-4 sm:py-3.5 sm:after:absolute sm:after:top-1/2 sm:after:left-full sm:after:h-px sm:after:w-4 sm:after:bg-line-strong sm:last:after:hidden"
          >
            <span className="font-mono text-xs text-fg">{stage.name}</span>
            <span className="text-sm leading-snug text-pretty text-muted sm:mt-1 sm:block">
              {stage.detail}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
