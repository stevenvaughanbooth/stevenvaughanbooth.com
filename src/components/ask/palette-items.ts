import type { Route } from 'next';
import { adage, person, type SectionId, sections } from '@/content/profile';

export interface GoToItem {
  id: SectionId | 'colophon';
  label: string;
  href: Route;
  keywords: string[];
}

export interface LinkItem {
  id: 'email' | 'copy-email' | 'github' | 'linkedin' | 'adage';
  label: string;
  hint: string;
  /** Absent for actions that stay in the palette. */
  href?: string;
  keywords: string[];
}

/** Extra search words for sections whose label alone would not be found. */
const sectionKeywords: Partial<Record<string, string[]>> = {
  'open-source': [adage.name, 'reflex', 'demo', 'oss'],
  work: ['projects', 'ideas', 'themes', 'mcp', 'platform', 'productivity'],
  experience: ['career', 'timeline', 'roles', 'education', 'resume', 'awards', 'recognition'],
  contact: ['email', 'reach', 'hire'],
};

/** Every page section in reading order, then the colophon. */
export const goToItems: GoToItem[] = [
  ...sections.map((section) => ({
    id: section.id,
    label: section.label,
    href: `/#${section.id}` as const,
    keywords: sectionKeywords[section.id] ?? [],
  })),
  {
    id: 'colophon',
    label: 'Colophon · How I built this',
    href: '/colophon',
    keywords: ['stack', 'source', 'nextjs', 'website', 'claude code'],
  },
];

function shortUrl(href: string): string {
  return href.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
}

export const linkItems: LinkItem[] = [
  {
    id: 'email',
    label: 'Email Steven',
    hint: person.email,
    href: person.links.email,
    keywords: ['mail', 'contact', 'message', 'hire'],
  },
  {
    id: 'copy-email',
    label: 'Copy email address',
    hint: person.email,
    keywords: ['clipboard', 'contact'],
  },
  {
    id: 'github',
    label: 'GitHub',
    hint: shortUrl(person.links.github),
    href: person.links.github,
    keywords: ['code', 'repos', 'repositories', 'source'],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    hint: shortUrl(person.links.linkedin),
    href: person.links.linkedin,
    keywords: ['connect', 'profile', 'resume'],
  },
  {
    id: 'adage',
    label: `${adage.name} on GitHub`,
    hint: shortUrl(adage.links.repo).replace(/^github\.com\//, ''),
    href: adage.links.repo,
    keywords: ['repo', 'open', 'source', 'rust'],
  },
];
