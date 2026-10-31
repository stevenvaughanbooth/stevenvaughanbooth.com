'use client';

import type { MouseEvent, ReactNode } from 'react';

/**
 * The small-screen Sections menu's list, inside the header's popover (site-header.tsx), which the
 * native Popover API opens and dismisses (light dismiss, Esc, top layer). The links are rendered
 * on the server; this adds only what a press on one needs.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  function onNavigate(event: MouseEvent<HTMLElement>) {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    // Leave modified clicks (new tab, new window) to the browser.
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();
    // Hiding the popover hands focus back to the Sections button, and a native fragment
    // navigation would then blur it. On the home page, navigate here instead and move focus to
    // the section's heading, so keyboard and screen reader users continue from there. Elsewhere
    // the link loads the home page at that section.
    const id = new URL(link.href).hash.slice(1);
    const section = window.location.pathname === '/' && id ? document.getElementById(id) : null;
    const heading = section?.querySelector<HTMLElement>('h2');
    if (!section || !heading) return;
    event.preventDefault();
    window.history.pushState(null, '', `/#${id}`);
    section.scrollIntoView({ block: 'start' });
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  return (
    <nav aria-label="Sections" onClick={onNavigate}>
      {children}
    </nav>
  );
}
