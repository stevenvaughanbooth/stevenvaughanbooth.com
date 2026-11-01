import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { caseStudies } from '@/content/case-studies';
import { person, site } from '@/content/profile';
import { articleJsonLd, jsonLd, portrait, publicProfile, serializeJsonLd } from './structured-data';

/** A file in public/, as the site serves it. */
const publicFile = (path: string) => readFileSync(join(process.cwd(), 'public', path));

/** Width and height from a JPEG's start-of-frame segment (baseline or progressive). */
function jpegSize(jpeg: Buffer): [number, number] | undefined {
  for (let at = 2; at + 9 < jpeg.length; at += 2 + jpeg.readUInt16BE(at + 2)) {
    const marker = jpeg[at + 1] ?? 0;
    if (marker >= 0xc0 && marker <= 0xc2) {
      return [jpeg.readUInt16BE(at + 7), jpeg.readUInt16BE(at + 5)];
    }
  }
  return undefined;
}

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

  it('uses absolute URLs on this domain for the site and a sized portrait', () => {
    expect(node('WebSite')?.url).toBe(site.url);
    expect(node('Person')?.image).toEqual({
      '@type': 'ImageObject',
      url: `${site.url}/steven-booth.jpg`,
      width: portrait.width,
      height: portrait.height,
    });
    // The JPEG's own size, from its frame header, matches what the graph says, and it stays small.
    const jpeg = publicFile(portrait.path);
    expect(jpegSize(jpeg)).toEqual([portrait.width, portrait.height]);
    expect(jpeg.length).toBeLessThan(80 * 1024);
  });

  it('lists each subject Steven knows once', () => {
    const topics = node('Person')?.knowsAbout as string[];
    expect(new Set(topics).size).toBe(topics.length);
    expect(topics.filter((topic) => /MCP|Model Context Protocol/.test(topic))).toHaveLength(1);
  });

  it('cannot close its script element early', () => {
    const html = serializeJsonLd({ text: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html)).toEqual({ text: '</script><script>alert(1)</script>' });
    expect(JSON.parse(serializeJsonLd(jsonLd))).toEqual(jsonLd);
  });
});

describe('case study JSON-LD', () => {
  it('names its image, its date and its author by the home page’s @id', () => {
    for (const study of caseStudies) {
      const article = articleJsonLd(study);
      const url = `${site.url}/work/${study.id}`;
      expect(article).toMatchObject({
        '@type': 'Article',
        url,
        headline: study.theme.title,
        image: { url: `${url}/opengraph-image`, width: 1200, height: 630 },
        author: { '@id': node('Person')?.['@id'], name: person.name },
        isPartOf: { '@id': node('WebSite')?.['@id'] },
      });
      expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('/.well-known/security.txt', () => {
  it('names the profile’s email and an expiry within a year of the date it was written', () => {
    const text = publicFile('.well-known/security.txt').toString('utf8');
    expect(text).toContain(`Contact: mailto:${person.email}`);
    expect(text).toContain(`Canonical: ${site.url}/.well-known/security.txt`);
    const expires = /^Expires: (.+)$/m.exec(text)?.[1];
    expect(Number.isNaN(Date.parse(expires ?? ''))).toBe(false);
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
