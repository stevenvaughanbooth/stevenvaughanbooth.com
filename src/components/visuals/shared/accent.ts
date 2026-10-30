import type { Accent } from '@/content/profile';

/** Classes that carry a visual's theme accent. Tailwind needs every class name written out. */
export interface VisualAccent {
  /** The dot beside the visual's title and the live status dot. */
  dot: string;
  /** A selected tab's border: the 1.4.11 cue, at least 3:1 against the track in both themes. */
  selectedBorder: string;
  /** A selected tab's step number. */
  selectedNumber: string;
  /** Auto-advance progress inside the selected tab. */
  progress: string;
}

export const visualAccent: Record<Accent, VisualAccent> = {
  green: {
    dot: 'bg-green',
    selectedBorder: 'aria-selected:border-green',
    selectedNumber: 'group-aria-selected:text-green',
    progress: 'bg-green',
  },
  amber: {
    dot: 'bg-amber',
    selectedBorder: 'aria-selected:border-amber',
    selectedNumber: 'group-aria-selected:text-amber',
    progress: 'bg-amber',
  },
  lilac: {
    dot: 'bg-lilac',
    selectedBorder: 'aria-selected:border-lilac',
    selectedNumber: 'group-aria-selected:text-lilac',
    progress: 'bg-lilac',
  },
  blue: {
    dot: 'bg-blue',
    selectedBorder: 'aria-selected:border-blue',
    selectedNumber: 'group-aria-selected:text-blue',
    progress: 'bg-blue',
  },
};
