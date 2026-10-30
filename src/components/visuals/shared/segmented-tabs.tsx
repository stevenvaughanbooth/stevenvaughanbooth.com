import type { Accent } from '@/content/profile';
import { visualAccent } from './accent';
import { panelId, tabId } from './ids';
import { onRovingKeyDown } from './roving-tabs';
import styles from './segmented-tabs.module.css';

/** Two-digit step numbers ('01', '02', …), the one format every visual uses. */
export function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

interface SegmentedTabsProps {
  /** Base id shared with the panel: tabs are `${id}-tab-${index}`, the panel is `${id}-panel`. */
  id: string;
  label: string;
  items: readonly string[];
  selected: number;
  accent: Accent;
  /** Omitted in the static server render, which has no behaviour. */
  onSelect?: (index: number) => void;
  /** Auto-advance progress, drawn inside the selected tab. */
  progress?: { durationMs: number; running: boolean } | null;
}

/**
 * A segmented tablist. The selected tab is marked by an accent border (at least 3:1 against the
 * track, so the cue survives without colour vision), a surface fill and a heavier weight; under
 * forced colours the border becomes Highlight. Labels wrap rather than truncate.
 */
export function SegmentedTabs({
  id,
  label,
  items,
  selected,
  accent,
  onSelect,
  progress,
}: SegmentedTabsProps) {
  const tone = visualAccent[accent];
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`${styles.tablist} grid gap-1 rounded-xl border border-line bg-bg p-1`}
    >
      {items.map((item, index) => {
        const isSelected = index === selected;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            id={tabId(id, index)}
            aria-selected={isSelected}
            aria-controls={panelId(id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={onSelect && (() => onSelect(index))}
            onKeyDown={
              onSelect && ((event) => onRovingKeyDown(event, index, items.length, onSelect))
            }
            className={`group relative flex min-h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent px-1 py-1 text-center text-[0.8125rem] leading-tight font-medium text-muted transition-colors hover:text-fg aria-selected:bg-surface aria-selected:text-fg aria-selected:shadow-card @[26rem]:flex-row @[26rem]:gap-1.5 forced-colors:border-[Canvas] forced-colors:aria-selected:border-[Highlight] ${tone.selectedBorder}`}
          >
            <span aria-hidden className={`font-mono text-micro text-subtle ${tone.selectedNumber}`}>
              {formatIndex(index)}
            </span>
            {/* A hidden semibold copy reserves the selected width, so selecting never re-wraps. */}
            <span className="grid">
              <span className="[grid-area:1/1] group-aria-selected:font-semibold">{item}</span>
              <span aria-hidden className="invisible font-semibold [grid-area:1/1]">
                {item}
              </span>
            </span>
            {isSelected && progress ? (
              <span
                aria-hidden
                className={`${styles.progress} absolute inset-x-3 bottom-1 h-0.5 rounded-full ${tone.progress}`}
                style={{
                  animationDuration: `${progress.durationMs}ms`,
                  animationPlayState: progress.running ? 'running' : 'paused',
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
