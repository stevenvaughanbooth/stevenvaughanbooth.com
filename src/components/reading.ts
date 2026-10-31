import type { CSSProperties } from 'react';
import type { SectionId } from '@/content/profile';

/** The view timeline a section publishes for the reading marks (globals.css). */
export const readingTimeline = (id: SectionId) => `--read-${id}`;

/** For a nav item that shows whether its section is being read (reading.module.css). */
export const readingStyle = (id: SectionId) =>
  ({ '--reading': readingTimeline(id) }) as CSSProperties;
