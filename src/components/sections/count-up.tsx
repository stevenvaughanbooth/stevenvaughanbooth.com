import type { CSSProperties } from 'react';
import styles from './count-up.module.css';

interface Figure {
  value: number;
  suffix: string;
}

/**
 * Splits a figure such as "48%" into the whole number that counts and the unit after it. Text
 * before the number would move as the count changes width, so such figures don't count.
 */
export function parseFigure(text: string): Figure | null {
  const match = /^(\d+)(\D*)$/.exec(text);
  if (!match) return null;
  const [, digits = '', suffix = ''] = match;
  return { value: Number(digits), suffix };
}

/**
 * A figure that counts up once as it scrolls into view, in CSS alone (count-up.module.css). The
 * real text is always in the DOM, so screen readers, search, copy and pages without CSS support
 * get the true number; the count is drawn over it. Text that isn't a whole number stays as it is.
 */
export function CountUp({ text, className = '' }: { text: string; className?: string }) {
  const figure = parseFigure(text);
  if (!figure) return <span className={className}>{text}</span>;
  return (
    <span
      className={`${styles.figure} ${className}`}
      data-suffix={figure.suffix}
      style={{ '--count-to': figure.value } as CSSProperties}
    >
      <span className={styles.text}>{text}</span>
    </span>
  );
}
