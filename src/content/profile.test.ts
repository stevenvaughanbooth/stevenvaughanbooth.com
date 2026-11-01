import { describe, expect, it } from 'vitest';
import {
  adage,
  awards,
  careerStartYear,
  describeAward,
  experience,
  highlights,
  person,
  projects,
  sections,
  themes,
} from './profile';

const firstPerson = /\b(I|I’m|I've|I’ve|me|my|mine|we|our)\b/;

describe('profile content', () => {
  it('lists roles most recent first, with exactly one current role', () => {
    expect(experience[0]?.end).toBe('Present');
    expect(experience.filter((role) => role.end === 'Present')).toHaveLength(1);
    experience.slice(1).forEach((role, i) => expect(role.end).toBe(experience[i]?.start));
  });

  it('starts the career in the year the timeline starts', () => {
    expect(experience.at(-1)?.start).toContain(String(careerStartYear));
  });

  it('uses unique ids for themes, projects, awards and sections', () => {
    for (const list of [themes, projects, awards, sections]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });

  it('links only to https or mailto URLs', () => {
    const urls = [...Object.values(person.links), ...Object.values(adage.links)];
    urls.forEach((url) => expect(url).toMatch(/^(https:\/\/|mailto:)/));
  });

  it('keeps award copy complete, with no empty fragments', () => {
    awards.forEach((award) => {
      expect(award.year).toMatch(/^FY\d{2}$/);
      expect(award.reason.length).toBeGreaterThan(10);
      expect(describeAward(award)).toMatch(/^\S.*\.$/);
      expect(describeAward(award)).not.toMatch(/\s{2}|undefined/);
    });
  });

  it('keeps the qualifier with the top 1% claim', () => {
    expect(awards.find((award) => award.id === 'presidents-award')?.detail).toContain(
      'top 1% of Salesforce engineers',
    );
    expect(highlights.find((item) => item.value === 'Top 1%')?.label).toMatch(
      /^of Salesforce engineers · FY24 President’s Award$/,
    );
  });
});

describe('Adage evidence', () => {
  const { results, summary, candor } = adage.evidence;
  const prose = `${summary} ${candor}`;
  const [modPrototype, heldOut] = results;

  it('never shows a figure without its caveat, directly after it', () => {
    for (const result of results) {
      expect(result.caveat.length).toBeGreaterThan(40);
      expect(prose).toContain(result.value);
      expect(prose).toContain(result.caveat);
      // The figure's own sentence, then its caveat, with no other figure between them.
      const at = prose.indexOf(`${result.value} ${result.label}`);
      const between = prose.slice(at, prose.indexOf(result.caveat));
      expect(between.split('. ')).toHaveLength(2);
    }
  });

  it('leads with the held-out result, then the development evidence', () => {
    expect(prose.indexOf(heldOut.value)).toBeLessThan(prose.indexOf(modPrototype.value));
    expect(summary).toMatch(/^In a held-out advisory comparison/);
  });

  it('states that the mod prototype’s result is development evidence', () => {
    expect(summary).toContain('development evidence, not a held-out result');
    expect(summary).toContain('runs 1–3');
    expect(summary).toContain('Claude Sonnet 5.5');
    expect(summary).toContain('mod prototype supplied approved steps');
    expect(summary).toContain('command hooks cut requests by about 14%');
  });

  it('includes the held-out advisory comparison and the negative results', () => {
    expect(summary).toContain('held-out advisory comparison');
    expect(summary).toContain('Claude Haiku 4.5');
    expect(summary).toContain('19 of 20 runs');
    expect(candor).toMatch(/negative results/);
  });

  it('writes the passage in sentences, each figure once', () => {
    expect(prose.split('48%')).toHaveLength(2);
    // Every sentence starts with a capital and has a verb-bearing length, not a caption.
    for (const sentence of prose.split(/(?<=\.)\s+/)) expect(sentence).toMatch(/^[A-Z].{30,}\.$/);
  });

  it('quotes the README’s privacy principle exactly', () => {
    expect(adage.principles[0]).toBe(
      'History stays local. Normal learning and matching do not send transcripts to a model or service.',
    );
  });
});

describe('voice', () => {
  it('keeps third-person summaries free of first-person pronouns', () => {
    const thirdPerson = [
      person.about.headline,
      person.about.introduction,
      ...themes.map((theme) => theme.about),
      ...projects.map((project) => project.about),
    ];
    thirdPerson.forEach((text) => expect(text).not.toMatch(firstPerson));
  });
});
