import { describe, expect, it, vi } from 'vitest';
import { person, site } from '@/content/profile';
import { jsonLd, publicProfile, serializeJsonLd } from './structured-data';

vi.mock('@/assets/headshot.jpeg', () => ({
  default: { src: '/_next/static/media/headshot.jpeg', width: 1640, height: 2048 },
}));

const node = (type: string): Record<string, unknown> | undefined =>
  jsonLd['@graph'].find((entry) => entry['@type'] === type);

describe('JSON-LD', () => {
  it('describes Steven as the main entity of the profile page', () => {
    const personNode = node('Person');
    expect(node('ProfilePage')?.mainEntity).toEqual({ '@id': personNode?.['@id'] });
    expect(personNode).toMatchObject({
      name: person.name,
      givenName: 'Steven',
      familyName: 'Booth',
      jobTitle: person.role,
      worksFor: { name: person.company },
      sameAs: [person.links.github, person.links.linkedin],
    });
  });

  it('uses absolute URLs on this domain for the site and the portrait', () => {
    expect(node('WebSite')?.url).toBe(site.url);
    expect(node('Person')?.image).toMatchObject({
      url: `${site.url}/_next/static/media/headshot.jpeg`,
    });
  });

  it('cannot close its script element early', () => {
    const html = serializeJsonLd({ text: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html)).toEqual({ text: '</script><script>alert(1)</script>' });
    expect(JSON.parse(serializeJsonLd(jsonLd))).toEqual(jsonLd);
  });
});

describe('profile.json', () => {
  it('keeps the original public profile keys and adds Adage', () => {
    expect(Object.keys(publicProfile)).toEqual(
      expect.arrayContaining([
        'name',
        'role',
        'company',
        'location',
        'domain',
        'introduction',
        'links',
        'experience',
        'projects',
        'awards',
        'education',
        'skills',
        'source',
        'themes',
        'public_references',
        'adage',
      ]),
    );
    expect(publicProfile.awards[0]?.name).toBe('FY24 President’s Award');
    expect(publicProfile.adage.evidence.candor).toMatch(/negative results/);
  });

  it('describes Steven in the third person', () => {
    const prose = [
      publicProfile.headline,
      publicProfile.introduction,
      ...publicProfile.projects.map((project) => project.summary),
      ...publicProfile.themes.map((theme) => theme.summary),
      publicProfile.ask.answers,
    ];
    prose.forEach((text) => expect(text).not.toMatch(/\b(I|I’m|me|my)\b/));
  });

  it('describes live answers as conditional', () => {
    expect(publicProfile.ask.answers).toMatch(/When live answers are on/);
    expect(publicProfile.ask.answers).toMatch(/points to email/);
  });
});
