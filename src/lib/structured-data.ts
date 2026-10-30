import headshot from '@/assets/headshot.jpeg';
import {
  adage,
  awards,
  describeAward,
  disclaimer,
  experience,
  person,
  projects,
  publicReferences,
  site,
  themes,
} from '@/content/profile';

const ids = {
  person: `${site.url}/#person`,
  website: `${site.url}/#website`,
  profilePage: `${site.url}/#profile-page`,
  adage: `${site.url}/#adage`,
};

const awardNames = awards.map((award) => `${award.year} ${award.name}`);

/** schema.org graph for the home page: the site, the profile page, Steven, and Adage. */
export const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': ids.website,
      url: site.url,
      name: person.name,
      description: site.description,
      inLanguage: 'en',
      publisher: { '@id': ids.person },
    },
    {
      '@type': 'ProfilePage',
      '@id': ids.profilePage,
      url: site.url,
      name: site.title,
      description: site.description,
      inLanguage: 'en',
      isPartOf: { '@id': ids.website },
      mainEntity: { '@id': ids.person },
    },
    {
      '@type': 'Person',
      '@id': ids.person,
      name: person.name,
      givenName: person.givenName,
      familyName: person.familyName,
      url: site.url,
      email: person.links.email,
      image: {
        '@type': 'ImageObject',
        url: new URL(headshot.src, site.url).href,
        width: headshot.width,
        height: headshot.height,
      },
      description: site.description,
      jobTitle: person.role,
      worksFor: {
        '@type': 'Organization',
        name: person.company,
        url: 'https://www.salesforce.com',
      },
      alumniOf: {
        '@type': 'CollegeOrUniversity',
        name: person.education.school,
        url: 'https://www.scu.edu',
      },
      homeLocation: { '@type': 'Place', name: person.location },
      knowsAbout: [
        ...person.skills,
        'Model Context Protocol',
        'Agent-facing APIs',
        'Platform engineering',
        'Developer tooling',
      ],
      award: awardNames,
      sameAs: [person.links.github, person.links.linkedin],
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': ids.adage,
      name: adage.name,
      description: adage.summary,
      url: adage.links.site,
      codeRepository: adage.links.repo,
      programmingLanguage: adage.language,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      creativeWorkStatus: adage.status,
      author: { '@id': ids.person },
    },
  ],
};

/**
 * JSON for an inline <script type="application/ld+json">. Escaping '<' keeps any string in the
 * data from closing the script element early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * The public profile served at /profile.json. Same shape as the original site's file, plus Adage.
 * Written in the third person: it is read without the page around it.
 */
export const publicProfile = {
  name: person.name,
  role: person.role,
  company: person.company,
  location: person.location,
  domain: site.domain,
  url: site.url,
  headline: person.about.headline,
  introduction: person.about.introduction,
  links: {
    linkedin: person.links.linkedin,
    github: person.links.github,
    email: person.links.email,
  },
  experience: experience.map(({ title, start, end, focus }) => ({ title, start, end, focus })),
  projects: projects.map(({ id, title, status, about }) => ({ id, title, status, summary: about })),
  awards: awards.map((award) => ({
    name: `${award.year} ${award.name}`,
    detail: describeAward(award),
  })),
  education: `${person.education.school} · ${person.education.degree}`,
  skills: person.skills,
  adage,
  source: disclaimer,
  ask: {
    type: 'Ask Steven: a command palette on every page (⌘K or Ctrl+K)',
    answers:
      'Preset topics are answered instantly from curated content. When live answers are on, Claude answers other questions from this public profile, with a small allowance per visitor; when they are off, or the allowance is used, the palette points to email instead.',
    contact: person.links.email,
  },
  themes: themes.map((theme) => ({
    id: theme.id,
    title: theme.kicker,
    summary: theme.about,
  })),
  public_references: publicReferences.map(({ label, href }) => ({ label, url: href })),
};
