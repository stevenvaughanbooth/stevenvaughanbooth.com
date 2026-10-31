import { caseStudies } from '@/content/case-studies';

/*
 * One case study per Work theme, prerendered with its Open Graph and Twitter images. Route
 * handlers do not inherit a layout's params, so the page and both images export this themselves,
 * each beside its own `dynamicParams = false` (segment config must be written in place), which
 * makes any other slug a 404.
 */
export function generateStaticParams() {
  return caseStudies.map((study) => ({ slug: study.id }));
}
