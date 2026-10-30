import type { MetadataRoute } from 'next';
import { darkTokens } from '@/lib/tokens';
import { person, site } from '@/content/profile';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.title,
    short_name: person.name,
    description: site.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'en',
    background_color: darkTokens.bg,
    theme_color: darkTokens.bg,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
