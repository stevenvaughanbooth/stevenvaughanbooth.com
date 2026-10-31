import { type ReactNode, ViewTransition } from 'react';
import type { CaseStudyId } from '@/content/case-studies';

/*
 * The case-study transition. A Work theme's kicker, title, lede and diagram appear both on the
 * home page and at the head of its case study, in the same columns. Navigating between the two,
 * each glides from one place to the other while the rest of the page fades through. Navigations
 * are transitions, so React runs all of it with no client code here. The browser's Back and
 * Forward buttons swap pages instantly: React renders history traversals synchronously, so the
 * browser can restore the scroll position, and a synchronous update starts no view transition.
 */

/**
 * Shared-element names. React pairs the <ViewTransition> that leaves the page with the one that
 * arrives under the same name. A name must be unique on a page, or the browser abandons the
 * whole transition.
 */
export const morphName = {
  kicker: (id: CaseStudyId) => `work-${id}-kicker`,
  title: (id: CaseStudyId) => `work-${id}-title`,
  lede: (id: CaseStudyId) => `work-${id}-lede`,
  visual: (id: CaseStudyId) => `work-${id}-visual`,
};

/**
 * The transition type of a navigation by the case studies' pager. Its card titles become the next
 * page's heading at a larger size and with new line breaks, so for this type the old text leaves
 * before the new arrives, and the two never show at once.
 */
export const pagerTransition = 'case-study-pager';

/**
 * Morphs its child into the element with the same name on the next page, and back again. It
 * animates only as one of a pair: `default="none"` keeps other transitions, such as a diagram's
 * controller swapping in, from animating it on its own, so `share` has to be set explicitly.
 */
export function Morph({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ViewTransition
      name={name}
      share={{
        [pagerTransition]: 'case-study-morph case-study-resize',
        default: 'case-study-morph',
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

/**
 * Fades its child out as the page leaves and in as it arrives, around the morphing elements,
 * which travel separately. Without it, React swaps everything outside a <ViewTransition> at once.
 */
export function FadeThrough({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="case-study-fade" exit="case-study-fade" default="none">
      {children}
    </ViewTransition>
  );
}
