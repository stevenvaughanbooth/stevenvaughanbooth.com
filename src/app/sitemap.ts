import type { MetadataRoute } from 'next';
import { caseStudies, caseStudyPath } from '@/content/case-studies';
import { site } from '@/content/profile';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: site.url, lastModified, changeFrequency: 'monthly', priority: 1 },
    ...caseStudies.map((study) => ({
      url: `${site.url}${caseStudyPath(study.id)}`,
      lastModified,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    })),
    { url: `${site.url}/colophon`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
