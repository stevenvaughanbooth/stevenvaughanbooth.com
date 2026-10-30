import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  'aria-hidden': true,
} as const;

const stroked = {
  ...base,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" {...props}>
      <path d="M4.5 2.9v10.2a.6.6 0 0 0 .9.5l8.1-5.1a.6.6 0 0 0 0-1L5.4 2.4a.6.6 0 0 0-.9.5Z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base} fill="currentColor" {...props}>
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  );
}

export function ReplayIcon(props: IconProps) {
  return (
    <svg {...stroked} {...props}>
      <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.8" />
      <path d="M2.5 2.5v3h3" />
    </svg>
  );
}

/** An in-page step forward, never an external link (that is ArrowUpRight). */
export function NextIcon(props: IconProps) {
  return (
    <svg {...stroked} {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
