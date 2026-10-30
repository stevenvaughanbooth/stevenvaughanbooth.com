import { ArrowDown } from '@/components/ui/icons';
import { person, sections } from '@/content/profile';
import styles from './arrival-film.module.css';

const filmIndex = sections.findIndex((section) => section.id === 'film');

/** The section after the film on the page, where the end plate's link continues. */
export const nextSection = filmIndex === -1 ? undefined : sections[filmIndex + 1];

/*
 * Text on the plate is set in container units with a 12px floor: the plate leans away from the
 * viewer, and its far edge renders about 7% smaller, so 12px keeps every line at 11px or more.
 */

/** The old intro's last beat: the monitor wakes into a terminal, which leads on down the page. */
export function EndPlate() {
  return (
    <div className={styles.screen}>
      <div className="flex size-full flex-col overflow-hidden rounded-[0.8cqw] border border-line-strong bg-surface font-mono text-fg shadow-[0_0_5cqw_var(--glow)]">
        <div
          aria-hidden
          className="flex items-center gap-[1.6cqw] border-b border-line px-[2.6cqw] py-[1.2cqw] text-[clamp(12px,1.45cqw,13px)] text-subtle"
        >
          <span className="flex gap-[0.7cqw]">
            <span className="size-[clamp(5px,0.9cqw,8px)] rounded-full border border-line-strong" />
            <span className="size-[clamp(5px,0.9cqw,8px)] rounded-full border border-line-strong" />
            <span className="size-[clamp(5px,0.9cqw,8px)] rounded-full border border-green bg-green/25" />
          </span>
          steven@workspace: ~
        </div>

        <div className="flex flex-1 flex-col justify-center px-[5.5cqw]">
          <p className="text-[clamp(12px,2.4cqw,19px)] text-muted">
            <span className={`${styles.typed} ${styles.greeting}`}>Welcome to my workspace.</span>
          </p>
          <p
            aria-hidden
            className="mt-[1.4cqw] flex items-center text-[clamp(19px,5cqw,40px)] leading-tight"
          >
            <span className="mr-[0.6em] text-green">❯</span>
            <span className={`${styles.typed} ${styles.command}`}>explore</span>
            <span
              className={`${styles.cursor} ml-[0.08em] inline-block h-[1.05em] w-[0.5em] bg-green`}
            />
          </p>
          {nextSection ? (
            <p className={`${styles.result} mt-[1.2cqw]`}>
              <a
                href={`#${nextSection.id}`}
                className="-mx-1 inline-flex min-h-6 items-center gap-1 rounded px-1 text-[clamp(12px,2.4cqw,19px)] text-green underline-offset-4 hover:underline"
              >
                Continue to {nextSection.label}
                <ArrowDown width="1em" height="1em" />
              </a>
            </p>
          ) : null}
        </div>

        <div
          aria-hidden
          className="hidden justify-between border-t border-line px-[2.6cqw] py-[1.1cqw] text-[clamp(12px,1.2cqw,13px)] tracking-[0.14em] text-subtle uppercase @md:flex"
        >
          <span>{person.name}</span>
          <span>Engineer / Builder</span>
        </div>
      </div>
    </div>
  );
}
