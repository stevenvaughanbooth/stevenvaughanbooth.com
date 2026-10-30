import type { ReactNode } from 'react';

interface SectionHeadingProps {
  id: string;
  label: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}

/**
 * A section's label, h2 and intro. The h2 accepts programmatic focus (tabIndex -1), so section
 * links can move keyboard and screen reader users into the section they jump to.
 */
export function SectionHeading({ id, label, title, children }: SectionHeadingProps) {
  return (
    <header className="max-w-3xl">
      <p className="label">{label}</p>
      <h2 id={id} tabIndex={-1} className="mt-4 text-title font-semibold text-balance">
        {title}
      </h2>
      {children ? (
        <div className="mt-5 text-lg leading-relaxed text-pretty text-muted">{children}</div>
      ) : null}
    </header>
  );
}
