import type { MetadataRoute } from 'next';
import { caseStudies, caseStudyPath } from '@/content/case-studies';
import { site } from '@/content/profile';

// No lastModified: a build date would claim every page changed on every deploy, and nothing
// records when each page's content last did.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, changeFrequency: 'monthly', priority: 1 },
    ...caseStudies.map((study) => ({
      url: `${site.url}${caseStudyPath(study.id)}`,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    })),
    { url: `${site.url}/colophon`, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
