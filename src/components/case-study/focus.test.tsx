import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { CaseStudyFocus } from './focus';

/** The home page's opener, and the case study while it is on screen. */
function Page({ caseStudy = true }: { caseStudy?: boolean }) {
  return (
    <>
      <a id="opener" href="#work-mcp">
        Read the case study
      </a>
      {caseStudy ? (
        <>
          <h1 id="heading" tabIndex={-1}>
            Give an agent a map.
          </h1>
          {/* A plain link standing in for next/link: the test moves the URL itself. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/work/platform" rel="next" onClick={(event) => event.preventDefault()}>
            Next
          </a>
          <CaseStudyFocus heading="heading" opener="opener" anchor="work-mcp" />
        </>
      ) : null}
    </>
  );
}

const go = (url: string) => window.history.pushState(null, '', url);
const opener = () => screen.getByRole('link', { name: 'Read the case study' });
const next = () => screen.getByRole('link', { name: 'Next' });
const heading = () => screen.getByRole('heading', { level: 1 });

/** Lays the page out with only the matching elements in view: jsdom has no layout of its own. */
function inView(match: (element: Element) => boolean) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = match(this) ? 300 : -2000;
    return { top, bottom: top + 40 } as DOMRect;
  });
}

describe('CaseStudyFocus', () => {
  beforeEach(() => go('/work/mcp'));
  // The visitor leaves by a link before the next test, as they would leave any case study.
  afterEach(() => {
    go('/colophon');
    cleanup();
    vi.restoreAllMocks();
  });

  it('focuses the heading when a client navigation renders the case study', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('leaves focus at the top on a page load, which hydrates the server’s HTML', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Page />);
    document.body.append(container);
    const root = await act(async () => hydrateRoot(container, <Page />));
    onTestFinished(() => {
      act(() => root.unmount());
      container.remove();
    });

    expect(document.body).toHaveFocus();
  });

  it('returns focus to the opener when the back link lands on its section', () => {
    const { rerender } = render(<Page />);
    go('/#work-mcp');
    rerender(<Page caseStudy={false} />);
    expect(opener()).toHaveFocus();
  });

  it('returns focus to the opener after the browser’s Back button', () => {
    const { rerender } = render(<Page />);
    go('/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    rerender(<Page caseStudy={false} />);
    expect(opener()).toHaveFocus();
  });

  it('does so when the router renders the home page inside popstate, before this listener', () => {
    // The router's listener is added first, as Next.js adds its own before any page mounts.
    const route = () => rerender(<Page caseStudy={false} />);
    window.addEventListener('popstate', route, { once: true });
    const { rerender } = render(<Page />);
    go('/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(opener()).toHaveFocus();
  });

  it('puts focus back if scrolling to the fragment then clears it, unless it has moved on', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'setTimeout'] });
    onTestFinished(() => void vi.useRealTimers());
    const back = (moveOn: () => void) => {
      const { rerender, unmount } = render(<Page />);
      go('/#work-mcp');
      window.dispatchEvent(new PopStateEvent('popstate'));
      rerender(<Page caseStudy={false} />);
      // What Chromium does when it scrolls to a fragment whose target cannot take focus.
      opener().blur();
      moveOn();
      vi.runAllTimers();
      const focused = document.activeElement;
      unmount();
      return focused;
    };

    expect(back(() => {})?.id).toBe('opener');
    const elsewhere = document.body.appendChild(document.createElement('button'));
    onTestFinished(() => elsewhere.remove());
    expect(back(() => elsewhere.focus())).toBe(elsewhere);
  });

  it('leaves focus alone on other ways home, such as the logo', () => {
    const { rerender } = render(<Page />);
    go('/');
    rerender(<Page caseStudy={false} />);
    expect(opener()).not.toHaveFocus();
  });

  it('leaves focus to the next case study when going there', () => {
    const { rerender } = render(<Page />);
    go('/work/platform');
    window.dispatchEvent(new PopStateEvent('popstate'));
    rerender(<Page caseStudy={false} />);
    expect(opener()).not.toHaveFocus();
  });

  describe('after Back or Forward to a case study', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      onTestFinished(() => void vi.useRealTimers());
    });

    /** Leaves the case study, by its Next link or not, and comes back to it with Back. */
    function leaveAndComeBack({ byLink, sync }: { byLink: boolean; sync: boolean }) {
      const { rerender } = render(<Page />);
      if (byLink) fireEvent.click(next());
      go('/work/platform');
      rerender(<Page caseStudy={false} />);
      go('/work/mcp');
      // A cached page renders inside the router's popstate listener; one that loads, after it.
      const route = () => rerender(<Page />);
      if (sync) window.addEventListener('popstate', route, { once: true });
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (!sync) route();
    }

    for (const sync of [true, false]) {
      it(`returns focus to the link it was left by (${sync ? 'cached' : 'loaded'} page)`, () => {
        inView((element) => element.getAttribute('rel') === 'next');
        leaveAndComeBack({ byLink: true, sync });
        // Not the heading, which is far above the scroll position the browser restores.
        expect(next()).toHaveFocus();
        vi.runAllTimers();
        expect(next()).toHaveFocus();
      });
    }

    it('without that link, focuses the heading once the page settles in view of it', () => {
      inView((element) => element.id === 'heading');
      leaveAndComeBack({ byLink: false, sync: true });
      expect(document.body).toHaveFocus();
      // The browser's restoring scroll is still moving.
      vi.advanceTimersByTime(80);
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(80);
      expect(document.body).toHaveFocus();
      vi.advanceTimersByTime(20);
      expect(heading()).toHaveFocus();
    });

    it('moves focus to the heading if the page settles in view of it, not of the link', () => {
      inView((element) => element.id === 'heading');
      leaveAndComeBack({ byLink: true, sync: true });
      expect(next()).toHaveFocus();
      vi.runAllTimers();
      expect(heading()).toHaveFocus();
    });

    it('leaves the heading alone when it is out of view', () => {
      inView(() => false);
      leaveAndComeBack({ byLink: false, sync: true });
      vi.runAllTimers();
      expect(document.body).toHaveFocus();
    });

    it('forgets a link the page was not left by', () => {
      inView((element) => element.getAttribute('rel') === 'next');
      const { rerender } = render(<Page />);
      fireEvent.click(next());
      // Something else, such as Ask, moves the page elsewhere.
      go('/colophon');
      rerender(<Page caseStudy={false} />);
      go('/work/mcp');
      window.dispatchEvent(new PopStateEvent('popstate'));
      rerender(<Page />);
      vi.runAllTimers();
      expect(next()).not.toHaveFocus();
    });

    it('moves focus that outlived the swap, such as on a footer link, to the heading in view', () => {
      inView((element) => element.id === 'heading');
      const { rerender } = render(<Page />);
      // The opener stands in for a link every page shares, which keeps focus through the swap.
      opener().focus();
      go('/work/platform');
      rerender(<Page caseStudy={false} />);
      go('/work/mcp');
      window.dispatchEvent(new PopStateEvent('popstate'));
      rerender(<Page />);
      expect(opener()).toHaveFocus();
      vi.runAllTimers();
      expect(heading()).toHaveFocus();
    });

    it('leaves focus where the visitor has moved it meanwhile', () => {
      inView(() => true);
      leaveAndComeBack({ byLink: false, sync: true });
      opener().focus();
      vi.runAllTimers();
      expect(opener()).toHaveFocus();
    });

    it('still focuses the heading when a link later returns to the same case study', () => {
      leaveAndComeBack({ byLink: false, sync: true });
      vi.runAllTimers();
      go('/work/platform');
      cleanup();
      go('/work/mcp');
      render(<Page />);
      expect(heading()).toHaveFocus();
    });
  });
});
