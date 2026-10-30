import type { Accent } from '@/content/profile';

/** Text color class for each theme accent. Tailwind needs the full class names written out. */
export const accentText: Record<Accent, string> = {
  green: 'text-green',
  amber: 'text-amber',
  lilac: 'text-lilac',
  blue: 'text-blue',
};
