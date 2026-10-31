'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

interface CaseStudyFocusProps {
  /** The case study's heading, which takes focus on arrival. */
  heading: string;
  /** The home page link that opened the case study, which takes focus again on the way back. */
  opener: string;
  /** The opener's section on the home page, the case study's way back. */
  anchor: string;
}

/** A link on a case study, found again by its href and its place among the links to the same address. */
interface LinkRef {
  href: string;
  index: number;
}

/**
 * The link each case study was last left by, keyed by its path. Back and Forward render the page
 * afresh, so focus goes back to the link by where it sits, not by the element.
 */
const leftBy = new Map<string, LinkRef>();

/**
 * The address the last history traversal arrived at, until a link moves on from it. The listener
 * is added by the first case study and stays, since Back can return to a case study from any page.
 */
let traversedTo: string | undefined;
let listening = false;
const onTraversal = () => {
  traversedTo = window.location.href;
};

const sameLinks = (href: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(
    (link) => link.getAttribute('href') === href,
  );

const findLink = (ref: LinkRef | undefined) => (ref ? sameLinks(ref.href)[ref.index] : undefined);

/** Whether any of the element shows in the viewport. */
function onScreen(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < window.innerHeight;
}

/**
 * Calls back once the page has been still for a moment. After Back or Forward the browser restores
 * the page's scroll position once the page has rendered, smoothly when motion is allowed, so where
 * the visitor will be looking is known only then. Returns a function that stops waiting.
 */
function afterScrolling(callback: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function done() {
    window.removeEventListener('scroll', wait);
    callback();
  }
  function wait() {
    clearTimeout(timer);
    timer = setTimeout(done, 100);
  }
  window.addEventListener('scroll', wait, { passive: true });
  wait();
  return () => {
    clearTimeout(timer);
    window.removeEventListener('scroll', wait);
  };
}

/**
 * Keeps keyboard and screen reader users in place across the client navigations into and out of
 * a case study. Next.js leaves focus untouched on navigation, on a link the new page no longer
 * has. Arriving from another page of the site by a link focuses the case study's heading; going
 * back to the home page, by its back link or the browser's Back button, returns focus to the link
 * that opened it, as closing a dialog returns focus to its trigger. Back and Forward to a case
 * study return to where the visitor was on it, so focus goes to the link they left by, such as
 * the Next card, or to the heading when the page is back at the top. A visitor who loads the page
 * directly starts at the top, as on any page load.
 */
export function CaseStudyFocus({ heading, opener, anchor }: CaseStudyFocusProps) {
  // Hydrating the server's HTML means a page load; rendering on the client from the start means
  // a client navigation. The first render's answer is the one kept.
  const client = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [navigated] = useState(client);

  useEffect(() => {
    if (!listening) {
      listening = true;
      window.addEventListener('popstate', onTraversal);
    }
    const page = window.location.pathname;

    // Back and Forward render a cached page inside the router's popstate listener, so this effect
    // runs during the event; a page that had to load arrives after it, as recorded above.
    const traversal = window.event?.type === 'popstate' || traversedTo === window.location.href;
    let stopWaiting: (() => void) | undefined;
    if (navigated && traversal) {
      // The browser restores the scroll position the page was left at, so the heading may be far
      // above it, and focusing it would make the first Tab jump back to the top. The link the
      // page was left by is where the visitor was, so it takes focus at once. Without one, or if
      // it is out of view once the page settles, the heading does when it is in view.
      const link = findLink(leftBy.get(page));
      link?.focus({ preventScroll: true });
      const arrived = document.activeElement;
      stopWaiting = afterScrolling(() => {
        // The visitor has moved focus meanwhile, or the link is in view.
        if (document.activeElement !== arrived) return;
        if (link && arrived === link && onScreen(link)) return;
        const title = document.getElementById(heading);
        if (title && onScreen(title)) title.focus({ preventScroll: true });
      });
    } else if (navigated) {
      document.getElementById(heading)?.focus({ preventScroll: true });
    }

    // The link the visitor activates, kept if the page is then left for its address.
    let clicked: { url: string; ref: LinkRef } | undefined;
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute('href') ?? '';
      clicked = { url: link.href, ref: { href, index: sameLinks(href).indexOf(link) } };
    };
    document.addEventListener('click', onClick, true);

    // The browser's Back and Forward buttons fire popstate. When the page they return to is
    // cached, the router renders it synchronously inside its own popstate listener, which was
    // added first, so this cleanup runs during that event, before this listener's turn. That
    // case is recognised the way React recognises it, by the event being dispatched. Going back
    // to a fragment of this page is not leaving it.
    let traversed = false;
    const onPopState = () => {
      traversed ||= window.location.pathname !== page;
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      stopWaiting?.();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      traversed ||= window.event?.type === 'popstate';
      // Cleanup runs once the next page has replaced this one. Still on this page, nothing left.
      const { pathname, hash, href } = window.location;
      if (pathname === page) return;
      if (!traversed) {
        traversedTo = undefined;
        if (clicked?.url === href) leftBy.set(page, clicked.ref);
        else leftBy.delete(page);
      }
      // Other ways home, such as the logo, start at the top of the page and leave focus alone.
      if (pathname !== '/' || !(traversed || hash === `#${anchor}`)) return;
      const restore = () => document.getElementById(opener)?.focus({ preventScroll: true });
      restore();
      // Going back to a URL with a fragment, the browser then scrolls to it in the next frame,
      // and Chromium clears focus when the target cannot take it. Put focus back after that
      // frame, unless the visitor has already moved it.
      if (traversed && hash) {
        requestAnimationFrame(() =>
          setTimeout(() => {
            if (document.activeElement === document.body) restore();
          }),
        );
      }
    };
  }, [navigated, heading, opener, anchor]);

  return null;
}
