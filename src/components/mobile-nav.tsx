'use client';

import { type MouseEvent, useRef } from 'react';
import type { NavItem } from './site-header';

/** Section menu for small screens, built on the native Popover API (light dismiss, Esc, top layer). */
export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const menu = useRef<HTMLDivElement>(null);

  function onNavigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // Leave modified clicks (new tab, new window) to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    menu.current?.hidePopover();
    // Hiding the popover hands focus back to the Sections button, and a native fragment
    // navigation would then blur it. On the home page, navigate here instead and move focus to
    // the section's heading, so keyboard and screen reader users continue from there. Elsewhere
    // the link loads the home page at that section.
    const section = window.location.pathname === '/' ? document.getElementById(id) : null;
    const heading = section?.querySelector<HTMLElement>('h2');
    if (!section || !heading) return;
    event.preventDefault();
    window.history.pushState(null, '', `/#${id}`);
    section.scrollIntoView({ block: 'start' });
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="mobile-nav"
        aria-label="Sections"
        className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg md:hidden"
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <div
        id="mobile-nav"
        ref={menu}
        popover="auto"
        className="inset-auto top-[4.5rem] right-3 left-3 m-0 w-auto rounded-2xl border border-line bg-surface p-2 text-fg shadow-card"
      >
        <nav aria-label="Sections">
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`/#${item.id}`}
                  onClick={(event) => onNavigate(event, item.id)}
                  className="block rounded-xl px-4 py-3 text-base transition-colors hover:bg-elevated"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
