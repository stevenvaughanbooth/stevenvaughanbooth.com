import { caseStudies, caseStudyPath } from '@/content/case-studies';
import {
  adage,
  awards,
  careerStartYear,
  describeAward,
  disclaimer,
  experience,
  film,
  person,
  projects,
  publicReferences,
  recognitionAnchor,
  type SectionId,
  sections,
  site,
  themes,
} from '@/content/profile';

export const dynamic = 'force-static';

const url = (path: string) => `${site.url}${path}`;
const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join('\n');
const and = new Intl.ListFormat('en', { type: 'conjunction' });

/** What each home page section covers, for the link list below. */
const sectionSummaries: Record<SectionId, string> = {
  'open-source': `${adage.name}, his open-source experiment. ${adage.tagline}`,
  work: 'Three themes of his work, each with an interactive diagram and a case study.',
  experience: `Career progression at ${person.company} since ${careerStartYear}, recognition, and education.`,
  contact: 'Email first, then LinkedIn and GitHub.',
};

const link = (label: string, path: string, summary: string) =>
  `[${label}](${url(path)}): ${summary}`;

/** Home page sections in reading order, each followed by the anchors inside it. */
const siteLinks = sections.flatMap((section) => [
  link(section.label, `/#${section.id}`, sectionSummaries[section.id]),
  ...(section.id === 'work'
    ? themes.map((theme) => link(theme.kicker, `/#work-${theme.id}`, theme.about))
    : []),
  ...(section.id === 'experience'
    ? [
        link(
          'Recognition',
          `/#${recognitionAnchor}`,
          `${awards.map((award) => `${award.year} ${award.name}`).join(', ')}.`,
        ),
      ]
    : []),
]);

// Follows https://llmstxt.org: a title, a summary, detail without headings, then lists of links.
// Written in the third person throughout; the page itself speaks as Steven.
const body = `# ${person.name}

> ${person.role} at ${person.company}, based in ${person.location}. ${person.about.headline}

${person.about.introduction}

**Career.** At ${person.company} since ${careerStartYear}, from associate engineer to principal:

${list([
  ...experience.map(
    (role) => `${role.title}, ${role.start} – ${role.end}${role.focus ? `: ${role.focus}` : '.'}`,
  ),
  `Education: ${person.education.degree}, ${person.education.school}.`,
])}

**Selected work.**

${list(projects.map((project) => `${project.title} (${project.status}): ${project.about}`))}

**Recognition.**

${list(awards.map((award) => `${award.year} ${award.name}: ${describeAward(award)}`))}

**Open source: ${adage.name}.** ${adage.tagline} ${adage.summary} Status: ${adage.status}, written in ${adage.language}, ${adage.license}. Works with ${and.format(adage.harnesses)}. Install with \`${adage.install}\`. Evidence so far: ${adage.evidence.headline}. ${adage.evidence.context} ${adage.evidence.candor}

**Ask Steven.** Every page has a command palette, opened with ⌘K, Ctrl+K, or any “Ask” button. It searches the site’s sections and links and answers preset topics instantly from curated content. When live answers are on, Claude answers other questions from the same public profile, with a small allowance per visitor; when they are off, or the allowance is used, the palette points to email instead. For anything important, confirm with Steven directly.

**Sources.** ${disclaimer} The same facts are available as JSON at ${url('/profile.json')}.

## Site

${list([link('Home', '/', `Who Steven is, what he builds, and how to reach him. The hero's portrait opens with ${film.title} (${film.duration}), an optional film. ${film.note}`), ...siteLinks])}

## Case studies

${list(caseStudies.map((study) => link(study.theme.title, caseStudyPath(study.id), study.summary)))}

## Structured data

- [profile.json](${url('/profile.json')}): Roles, projects, recognition, ${adage.name}, and contact links as JSON.

## Contact

- [Email](${person.links.email}): ${person.email}, the best way to reach Steven.
- [LinkedIn](${person.links.linkedin})
- [GitHub](${person.links.github})

## ${adage.name}

- [Repository](${adage.links.repo}): Source, README, and install instructions.
- [Evidence](${adage.links.evidence}): Benchmarks with methods and limitations, including negative results.
- [Project site](${adage.links.site})

## Optional

- [Under the hood](${url('/colophon')}): The site's React components, when each one's code loads and why, then its stack, budgets and security model.
- [Source code for this site](${site.repo})
${publicReferences.map((ref) => `- [${ref.label}](${ref.href}): Public reference for product terminology.`).join('\n')}
`;

export function GET() {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
