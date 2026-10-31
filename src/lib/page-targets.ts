/**
 * The places on this site an answer can show the visitor: a page section, a Work theme, a career
 * role, the awards, or a theme's case study. Derived from profile.ts, so a target can only name
 * something that exists, and shared by everything that handles one: the curated answers, the
 * Claude tool's enum and the server's check of its input, the browser client's second check, the
 * career timeline's anchors and the code that performs the action. Anything not listed here is
 * ignored wherever it turns up. Pure data: safe on the server and in the browser.
 */
import {
  awards,
  experience,
  recognitionAnchor,
  type Role,
  sections,
  type Theme,
  themes,
} from '@/content/profile';

export type PageTargetKind = 'section' | 'theme' | 'role' | 'recognition' | 'case-study';

export interface PageTarget {
  id: string;
  kind: PageTargetKind;
  /** A noun phrase for buttons: "Show me {label}". */
  label: string;
  /** What the target is, for Claude's tool description. */
  about: string;
  /** The element's id on the home page. Absent for case studies, which are pages of their own. */
  anchor?: string;
  /** Where the target lives: the home page fragment, or the case study's route. */
  href: string;
  /**
   * The element that shows the same thing on one other page: a theme's diagram also heads its
   * case study, and a case study, seen from its own page, is its title.
   */
  alsoOn?: { path: string; anchor: string };
}

/** Short names for each theme's diagram and case study, in the words the Work section uses. */
const themeNames: Record<Theme['id'], { diagram: string; short: string }> = {
  devtools: { diagram: 'the team multiplier', short: 'team multiplier' },
  mcp: { diagram: 'the MCP diagram', short: 'MCP' },
  platform: { diagram: 'the platform diagram', short: 'platform' },
};

const sectionLabels: Partial<Record<string, string>> = {
  'open-source': 'the Adage demo',
  work: 'the Work section',
  experience: 'the career timeline',
  contact: 'the contact details',
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A role's stable anchor on the career timeline, e.g. `role-principal-engineer`. */
export function roleAnchor(role: Pick<Role, 'displayTitle'>): string {
  return `role-${slug(role.displayTitle)}`;
}

/** A theme's case study page. */
export const caseStudyHref = (id: Theme['id']) => `/work/${id}` as const;

/** Ids on every case study page that a target can land on. Neither is a target id itself. */
export const caseStudyAnchors = { title: 'case-study-title', diagram: 'diagram' } as const;

const anchored = (target: Omit<PageTarget, 'href'> & { anchor: string }): PageTarget => ({
  ...target,
  href: `/#${target.anchor}`,
});

/** Every target, most specific first. */
export const pageTargets: readonly PageTarget[] = [
  ...themes.map((theme) =>
    anchored({
      id: `work-${theme.id}`,
      kind: 'theme',
      label: themeNames[theme.id].diagram,
      about: `Work theme "${theme.kicker}": ${theme.title} With an interactive diagram.`,
      anchor: `work-${theme.id}`,
      alsoOn: { path: caseStudyHref(theme.id), anchor: caseStudyAnchors.diagram },
    }),
  ),
  ...themes.map((theme): PageTarget => ({
    id: `case-study-${theme.id}`,
    kind: 'case-study',
    label: `the ${themeNames[theme.id].short} case study`,
    about: `The case study page for "${theme.kicker}".`,
    href: caseStudyHref(theme.id),
    alsoOn: { path: caseStudyHref(theme.id), anchor: caseStudyAnchors.title },
  })),
  ...experience.map((role) =>
    anchored({
      id: roleAnchor(role),
      kind: 'role',
      label: `the ${role.displayTitle} role`,
      about: `The ${role.displayTitle} role on the career timeline, ${role.start} to ${role.end}.`,
      anchor: roleAnchor(role),
    }),
  ),
  anchored({
    id: recognitionAnchor,
    kind: 'recognition',
    label: 'the awards',
    about: `Recognition: ${awards.map((award) => `${award.name} (${award.year})`).join(', ')}.`,
    anchor: recognitionAnchor,
  }),
  ...sections.map((section) =>
    anchored({
      id: section.id,
      kind: 'section',
      label: sectionLabels[section.id] ?? `the ${section.label} section`,
      about: `The ${section.label} section of the home page.`,
      anchor: section.id,
    }),
  ),
];

declare const checked: unique symbol;
/** A target id that has been checked against the allowlist. */
export type PageTargetId = string & { readonly [checked]: true };

const byId = new Map(pageTargets.map((target) => [target.id, target]));

/** The allowlist, as a non-empty tuple for schema enums. */
export const pageTargetIds = pageTargets.map((target) => target.id) as [string, ...string[]];

export function isPageTargetId(value: unknown): value is PageTargetId {
  return typeof value === 'string' && byId.has(value);
}

/** The target with this id, or undefined for anything outside the allowlist. */
export function pageTarget(id: unknown): PageTarget | undefined {
  return typeof id === 'string' ? byId.get(id) : undefined;
}

/**
 * Where a target can be shown on the page at `pathname`: the id of its element there, and the URL
 * that records it. Undefined when the target is on another page.
 */
export function placeOn(
  target: PageTarget,
  pathname: string,
): { anchor: string; href: string } | undefined {
  if (target.anchor && pathname === '/') return { anchor: target.anchor, href: target.href };
  if (target.alsoOn?.path !== pathname) return undefined;
  const { anchor } = target.alsoOn;
  return { anchor, href: `${pathname}#${anchor}` };
}

/**
 * An answer's places as the page at `pathname` offers them: never a link to that page itself, so
 * a case study does not offer itself. Its theme's diagram stays, and is shown where it is.
 */
export function actionsOn(actions: readonly PageTargetId[], pathname: string): PageTargetId[] {
  return actions.filter((id) => pageTarget(id)?.href !== pathname);
}

/** For content written in this codebase: fails loudly on a typo instead of dropping an action. */
export function targetId(id: string): PageTargetId {
  if (!isPageTargetId(id)) throw new Error(`Unknown page target: ${id}`);
  return id;
}
