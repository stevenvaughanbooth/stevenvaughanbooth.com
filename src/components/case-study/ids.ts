import type { CaseStudyId } from '@/content/case-studies';

/** A theme's article in the home page's Work section: the case study's way back. */
export const workAnchor = (id: CaseStudyId) => `work-${id}`;

/** The theme's "Read the case study" link, which takes focus again on the way back. */
export const caseStudyLinkId = (id: CaseStudyId) => `work-${id}-case-study`;
