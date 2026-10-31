import { describe, expect, it } from 'vitest';
import { experience, recognitionAnchor, sections, themes } from '@/content/profile';
import {
  actionsOn,
  caseStudyAnchors,
  caseStudyHref,
  isPageTargetId,
  pageTarget,
  pageTargetIds,
  pageTargets,
  placeOn,
  roleAnchor,
  targetId,
} from './page-targets';

describe('page targets', () => {
  it('covers every section, every theme and its case study, every role, and the awards', () => {
    expect(pageTargetIds).toEqual(pageTargets.map((target) => target.id));
    expect(new Set(pageTargetIds).size).toBe(pageTargetIds.length);
    const expected = [
      ...sections.map((section) => section.id),
      ...themes.flatMap((theme) => [`work-${theme.id}`, `case-study-${theme.id}`]),
      ...experience.map(roleAnchor),
      recognitionAnchor,
    ];
    expect([...pageTargetIds].sort()).toEqual(expected.sort());
  });

  it('points in-page targets at their anchor on the home page, and case studies at their route', () => {
    for (const target of pageTargets) {
      if (target.kind === 'case-study') {
        expect(target.anchor).toBeUndefined();
        expect(target.href).toMatch(/^\/work\/(devtools|mcp|platform)$/);
      } else {
        expect(target.href).toBe(`/#${target.anchor}`);
      }
      expect(target.label).toMatch(/^the /);
      expect(target.about.length).toBeGreaterThan(10);
    }
    expect(caseStudyHref('mcp')).toBe('/work/mcp');
  });

  it('gives each role a stable, readable anchor', () => {
    expect(experience.map(roleAnchor)).toEqual([
      'role-principal-engineer',
      'role-lead-engineer',
      'role-senior-engineer',
      'role-member-of-technical-staff',
      'role-associate-engineer',
    ]);
  });

  it('accepts only allowlisted ids', () => {
    expect(isPageTargetId('work-mcp')).toBe(true);
    for (const value of ['film', 'Work-MCP', ' work-mcp', '#work', '/work/mcp', 42, null, {}]) {
      expect(isPageTargetId(value), String(value)).toBe(false);
      expect(pageTarget(value)).toBeUndefined();
    }
    expect(() => targetId('work-nope')).toThrow('Unknown page target: work-nope');
  });

  it('checks ids against the same list everywhere: the schema enum and the lookup agree', () => {
    for (const id of pageTargetIds) expect(pageTarget(id)?.id).toBe(id);
    // Places on a case study page are anchors, never ids Claude or an answer can name.
    for (const anchor of Object.values(caseStudyAnchors)) {
      expect(isPageTargetId(anchor), anchor).toBe(false);
    }
  });

  it('places a target on the page where the visitor is', () => {
    const at = (id: string, pathname: string) => placeOn(pageTarget(id)!, pathname);
    expect(at('work-mcp', '/')).toEqual({ anchor: 'work-mcp', href: '/#work-mcp' });
    expect(at('recognition', '/')).toEqual({ anchor: 'recognition', href: '/#recognition' });
    // A theme's diagram also heads its case study; the case study, on its own page, is its title.
    expect(at('work-mcp', '/work/mcp')).toEqual({ anchor: 'diagram', href: '/work/mcp#diagram' });
    expect(at('case-study-mcp', '/work/mcp')).toEqual({
      anchor: 'case-study-title',
      href: '/work/mcp#case-study-title',
    });
    // Anywhere else, it is somewhere else.
    expect(at('work-mcp', '/work/platform')).toBeUndefined();
    expect(at('case-study-mcp', '/')).toBeUndefined();
    expect(at('recognition', '/work/mcp')).toBeUndefined();
    expect(at('contact', '/colophon')).toBeUndefined();
  });

  it('never offers a link to the page the visitor is on', () => {
    const mcp = [targetId('work-mcp'), targetId('case-study-mcp')];
    expect(actionsOn(mcp, '/')).toEqual(mcp);
    expect(actionsOn(mcp, '/work/mcp')).toEqual(['work-mcp']);
    expect(actionsOn(mcp, '/work/platform')).toEqual(mcp);
    expect(actionsOn([targetId('contact')], '/work/mcp')).toEqual(['contact']);
  });
});
