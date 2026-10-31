import { describe, expect, it } from 'vitest';
import { steps } from '@/components/visuals/progressive-disclosure/steps';
import { stages } from '@/components/visuals/team-multiplier/stages';
import {
  adjacentCaseStudies,
  type CaseStudy,
  caseStudies,
  caseStudyParts,
  caseStudyPath,
  findCaseStudy,
} from './case-studies';
import * as profile from './profile';

const firstPerson = /\b(I|I’m|me|my)\b/;

/** Every string a case study puts on the page or in its metadata. */
function copy(study: CaseStudy): string[] {
  return [
    study.summary,
    ...Object.values(study.parts).flatMap((part) => [
      part.title,
      ...part.paragraphs,
      ...(part.steps ?? []).flatMap((step) => [step.name, step.title, step.body]),
      ...(part.facts ?? []).flatMap((fact) => [fact.value, fact.label]),
      part.note ?? '',
      part.link?.label ?? '',
    ]),
  ].filter(Boolean);
}

describe('case studies', () => {
  it('has one per Work theme, in the order of the Work section, at /work/<theme id>', () => {
    expect(caseStudies.map((study) => study.id)).toEqual(profile.themes.map((theme) => theme.id));
    caseStudies.forEach((study) => {
      expect(study.theme.id).toBe(study.id);
      expect(caseStudyPath(study.id)).toBe(`/work/${study.id}`);
      expect(findCaseStudy(study.id)).toBe(study);
    });
    expect(findCaseStudy('colophon')).toBeUndefined();
  });

  it('fills the four parts with complete sentences', () => {
    expect(caseStudyParts.map((part) => part.id)).toEqual([
      'problem',
      'approach',
      'impact',
      'next',
    ]);
    for (const study of caseStudies) {
      for (const { id } of caseStudyParts) {
        const part = study.parts[id];
        expect(part.title, `${study.id} ${id}`).toMatch(/^\S.*[.?]$/);
        expect(part.paragraphs.length, `${study.id} ${id}`).toBeGreaterThan(0);
        part.paragraphs.forEach((paragraph) => expect(paragraph).toMatch(/^\S.*[.?]$/));
      }
      copy(study).forEach((text) => expect(text).not.toMatch(/\s{2}|undefined|\.\./));
    }
  });

  it('speaks as Steven on the page and about him in the summary', () => {
    for (const study of caseStudies) {
      expect(study.summary).toContain(profile.person.name);
      expect(study.summary).not.toMatch(firstPerson);
      const paragraphs = Object.values(study.parts).flatMap((part) => part.paragraphs);
      expect(paragraphs.some((paragraph) => firstPerson.test(paragraph))).toBe(true);
    }
  });

  it('sets out the diagrams’ own steps, word for word', () => {
    const [devtools, mcp] = caseStudies;
    expect(devtools?.parts.approach.steps).toEqual(
      stages.map((stage) => ({ name: stage.name, title: stage.title, body: stage.detail })),
    );
    expect(mcp?.parts.approach.steps?.map((step) => step.body)).toEqual(
      steps.map((step) => step.copy),
    );
    expect(mcp?.parts.approach.note).toMatch(/conceptual, not a real API/);
  });

  it('adds no number that profile.ts does not already state', () => {
    const facts = JSON.stringify(Object.values(profile));
    for (const study of caseStudies) {
      for (const number of copy(study)
        .join(' ')
        .match(/\d+(?:\.\d+)?%?/g) ?? []) {
        expect(facts, `${study.id}: ${number}`).toContain(number);
      }
    }
  });

  it('quotes statuses and awards exactly as profile.ts states them', () => {
    const statuses = new Set<string>(profile.projects.map((project) => project.status));
    for (const study of caseStudies) {
      const parts = Object.values(study.parts);
      parts
        .flatMap((part) => part.steps ?? [])
        .forEach((step) => {
          if (step.status) expect(statuses).toContain(step.status);
        });
      parts
        .flatMap((part) => part.facts ?? [])
        .forEach((fact) => {
          expect(statuses.has(fact.value) || fact.value === 'Top 1%').toBe(true);
        });
    }
    const award = profile.awards.find((item) => item.id === 'presidents-award');
    expect(findCaseStudy('platform')?.parts.impact.paragraphs.join(' ')).toContain(
      `${award?.year} ${award?.name}, recognition for the top 1% of Salesforce engineers`,
    );
  });

  it('links each case study to its neighbours in order, with none past either end', () => {
    expect(adjacentCaseStudies('devtools')).toEqual({ previous: undefined, next: caseStudies[1] });
    expect(adjacentCaseStudies('mcp')).toEqual({ previous: caseStudies[0], next: caseStudies[2] });
    expect(adjacentCaseStudies('platform')).toEqual({ previous: caseStudies[1], next: undefined });
  });

  it('links only to home page sections that exist and to other case studies', () => {
    const sectionIds = new Set<string>(profile.sections.map((section) => section.id));
    for (const study of caseStudies) {
      const parts = Object.values(study.parts);
      parts.forEach(({ link }) => {
        if (!link) return;
        if (link.href.startsWith('/#')) expect(sectionIds).toContain(link.href.slice(2));
        else expect(caseStudies.map((item) => caseStudyPath(item.id))).toContain(link.href);
        expect(link.href).not.toBe(caseStudyPath(study.id));
      });
      parts
        .flatMap((part) => part.steps ?? [])
        .forEach((step) => {
          if (step.caseStudy) expect(step.caseStudy).not.toBe(study.id);
        });
    }
  });
});
