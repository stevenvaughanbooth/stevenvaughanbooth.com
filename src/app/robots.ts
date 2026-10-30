import type { MetadataRoute } from 'next';
import { site } from '@/content/profile';

export default function robots(): MetadataRoute.Robots {
  return {
    // Every page is public. /api/ is not content (Ask Steven's endpoint), so crawlers skip it.
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
