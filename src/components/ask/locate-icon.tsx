import type { SVGProps } from 'react';

/**
 * A place being pointed out: the icon on "Show me" actions and on the hero suggestion that shows
 * one. A module of its own, so the palette loader, which ships with every page, does not carry it.
 */
export function Locate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
