import { act } from '@testing-library/react';
import { vi } from 'vitest';

/*
 * Browser APIs jsdom lacks, as controllable fakes. Each helper stubs a global; call
 * vi.unstubAllGlobals() in afterEach to restore them.
 */

interface ShowOptions {
  /**
   * Whether observers with a rootMargin (which look past the viewport, such as the lazy loader's
   * 200px margin) report the element as intersecting. Defaults to `ratio > 0`.
   */
  near?: boolean;
}

/**
 * Replaces IntersectionObserver. `show(ratio)` reports every observed element as `ratio`
 * visible to every live observer, as if the page had scrolled there.
 */
export function mockIntersectionObserver() {
  const observers = new Set<FakeIntersectionObserver>();

  class FakeIntersectionObserver {
    readonly root = null;
    readonly rootMargin: string;
    private readonly targets = new Set<Element>();

    constructor(
      private readonly callback: IntersectionObserverCallback,
      options: IntersectionObserverInit = {},
    ) {
      this.rootMargin = options.rootMargin ?? '0px';
      observers.add(this);
    }

    observe(target: Element) {
      this.targets.add(target);
    }

    unobserve(target: Element) {
      this.targets.delete(target);
    }

    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }

    takeRecords() {
      return [];
    }

    report(ratio: number, near: boolean) {
      const margin = this.rootMargin.split(' ').some((value) => parseFloat(value) !== 0);
      const entries = [...this.targets].map(
        (target) =>
          ({
            target,
            isIntersecting: margin ? near : ratio > 0,
            intersectionRatio: ratio,
          }) as IntersectionObserverEntry,
      );
      if (entries.length > 0) this.callback(entries, this as unknown as IntersectionObserver);
    }
  }

  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

  return {
    show(ratio: number, { near = ratio > 0 }: ShowOptions = {}) {
      act(() => {
        for (const observer of [...observers]) observer.report(ratio, near);
      });
    },
  };
}

/** Replaces matchMedia, answering only the reduced-motion query. */
export function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

/** Sets document.visibilityState and fires visibilitychange. */
export function setPageVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
