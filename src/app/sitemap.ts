import type { MetadataRoute } from 'next';
import { site } from '@/content/profile';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: site.url, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${site.url}/colophon`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ];
}
