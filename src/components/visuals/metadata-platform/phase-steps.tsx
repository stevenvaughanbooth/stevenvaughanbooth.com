import { formatIndex } from '../shared/segmented-tabs';
import styles from './metadata-platform.module.css';

interface PhaseStepsProps {
  /** Every story's phase labels: the row reserves the height of the longest. */
  labels: readonly (readonly string[])[];
  story: number;
  phase: number;
  /** Omitted in the static server render, which has no behaviour. */
  onSelect?: (phase: number) => void;
  /** Auto-advance progress through the current phase; a new key restarts it. */
  progress?: { key: string; durationMs: number; running: boolean } | null;
}

/**
 * The current story's three phases. A bar above each fills as the story reaches it; the current
 * phase is also set in a heavier weight, so the cue does not rest on colour alone.
 */
export function PhaseSteps({ labels, story, phase, onSelect, progress }: PhaseStepsProps) {
  const current = labels[story] ?? [];
  return (
    <ol aria-label="Phases of this story" className="mt-3 grid grid-cols-3 gap-2 @sm:gap-3">
      {current.map((label, index) => {
        const isCurrent = index === phase;
        return (
          <li key={label} className="min-w-0">
            <button
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              onClick={onSelect && (() => onSelect(index))}
              className="group w-full rounded-md pt-1 pb-1.5 text-left text-xs leading-tight font-medium text-subtle transition-colors hover:text-fg aria-[current=step]:text-fg"
            >
              <span
                aria-hidden
                className="block h-0.5 overflow-hidden rounded-full bg-line forced-colors:bg-[GrayText]"
              >
                {isCurrent && progress ? (
                  <span
                    key={progress.key}
                    className={`${styles.progress} block h-full bg-lilac forced-colors:bg-[Highlight]`}
                    style={{
                      animationDuration: `${progress.durationMs}ms`,
                      animationPlayState: progress.running ? 'running' : 'paused',
                    }}
                  />
                ) : (
                  <span
                    className={`block h-full origin-left bg-lilac transition-transform duration-500 forced-colors:bg-[Highlight] ${index <= phase ? 'scale-x-100' : 'scale-x-0'}`}
                  />
                )}
              </span>
              {/* Each story's label for this phase, invisible and in the heavier weight, holds the cell's size. */}
              <span className="mt-2 grid">
                <span className="[grid-area:1/1] group-aria-[current=step]:font-semibold">
                  <span
                    aria-hidden
                    className="mr-1.5 font-mono text-micro text-subtle group-aria-[current=step]:text-lilac @max-xs:hidden"
                  >
                    {formatIndex(index)}
                  </span>
                  {label}
                </span>
                {labels.map((other, s) => (
                  <span key={s} aria-hidden className="invisible font-semibold [grid-area:1/1]">
                    <span className="mr-1.5 font-mono text-micro @max-xs:hidden">
                      {formatIndex(index)}
                    </span>
                    {other[index]}
                  </span>
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
