/**
 * The three Work themes as long-form case studies, one page each at /work/<theme id>.
 *
 * Facts come from profile.ts (themes, projects, awards, career) and from the diagrams' own step
 * copy, which each case study sets out again in words. The prose around them only frames those
 * facts: do not add a claim, a metric or an internal detail that the rest of the site does not
 * already make. Like the page, the copy speaks as Steven; `summary` restates each case study in
 * the third person for metadata and /llms.txt. The header above the four parts repeats the
 * theme's lede and body, so the parts avoid repeating them.
 */
import type { Route } from 'next';
import { stories } from '@/components/visuals/metadata-platform/stories';
import { steps as disclosureSteps } from '@/components/visuals/progressive-disclosure/steps';
import { stages } from '@/components/visuals/team-multiplier/stages';
import { adage, awards, careerStartYear, person, projects, type Theme, themes } from './profile';

export type CaseStudyId = Theme['id'];

/** The four parts of every case study, in reading order. */
export const caseStudyParts = [
  { id: 'problem', label: 'The problem' },
  { id: 'approach', label: 'The approach' },
  { id: 'impact', label: 'What changed' },
  { id: 'next', label: 'What’s next' },
] as const;

export type CaseStudyPartId = (typeof caseStudyParts)[number]['id'];

export interface CaseStudyStep {
  /** A short name, set as a mono label. */
  name: string;
  title: string;
  body: string;
  /** A conceptual tool call, shown as code. */
  call?: string;
  status?: string;
  /** Another case study that tells this step's story in full. */
  caseStudy?: CaseStudyId;
}

/** A fact a reader can check against the rest of the site: the figure, then its context. */
export interface CaseStudyFact {
  value: string;
  label: string;
}

export interface CaseStudyPart {
  title: string;
  paragraphs: readonly string[];
  steps?: readonly CaseStudyStep[];
  /** A caveat set under the steps. */
  note?: string;
  facts?: readonly CaseStudyFact[];
  /** Where to read on: a home page section, or another case study. */
  link?: { label: string; href: Route | CaseStudyPath };
}

export interface CaseStudy {
  id: CaseStudyId;
  theme: Theme;
  /** One sentence in the third person, for the meta description, Open Graph and /llms.txt. */
  summary: string;
  parts: Record<CaseStudyPartId, CaseStudyPart>;
}

export type CaseStudyPath = `/work/${CaseStudyId}`;

export const caseStudyPath = (id: CaseStudyId): CaseStudyPath => `/work/${id}`;

function theme(id: CaseStudyId): Theme {
  const found = themes.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown theme: ${id}`);
  return found;
}

function project(id: (typeof projects)[number]['id']) {
  const found = projects.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown project: ${id}`);
  return found;
}

function story(id: (typeof stories)[number]['id']) {
  const found = stories.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown story: ${id}`);
  return found;
}

const presidentsAward = awards.find((award) => award.id === 'presidents-award');
if (!presidentsAward) throw new Error('Missing the President’s Award in profile.ts');

const agentContext = story('agents');
const [extract, makeUsable, groundAgents] = agentContext.phases;
const migration = project('migration');
const schema = project('schema');
const performance = project('performance');
const mcpTools = project('mcp');

const devtools: CaseStudy = {
  id: 'devtools',
  theme: theme('devtools'),
  summary: `How ${person.name} helps useful AI tools and workflows take hold across his organization, as a Productivity Champion and developer tooling advocate.`,
  parts: {
    problem: {
      title: 'Better ways of working don’t spread on their own.',
      paragraphs: [
        'A lot has changed in how we can work with AI. I’m first in line to try new models and features in my own workflows.',
        'But a useful tool in one engineer’s hands is only a start. The value comes when it becomes everyday practice across teams.',
      ],
    },
    approach: {
      title: 'Discover. Share. Enable. Learn.',
      paragraphs: ['The work runs as a loop, and each turn starts from what the last one taught.'],
      steps: stages.map((stage) => ({ name: stage.name, title: stage.title, body: stage.detail })),
    },
    impact: {
      title: 'The multiplier is in the adoption.',
      paragraphs: [
        'A useful idea spreads, teams build on it, and more people benefit.',
        project('devtools').summary,
      ],
    },
    next: {
      title: 'Keep the practice evolving.',
      paragraphs: [
        'The loop doesn’t end. What teams learn comes back into the conversation, so useful practices keep evolving.',
        `${adage.name}, my open-source experiment, takes the same idea to agents: learn the repeatable parts of agent work, and reuse them next time.`,
      ],
      link: { label: `See ${adage.name}`, href: '/#open-source' },
    },
  },
};

const mcp: CaseStudy = {
  id: 'mcp',
  theme: theme('mcp'),
  summary: `How ${person.name} designs MCP tools around progressive disclosure, so agents and builders can discover and use Salesforce metadata.`,
  parts: {
    problem: {
      title: 'An agent has to decide what to ask next.',
      paragraphs: [
        extract.copy,
        'Handing an agent everything at once doesn’t help it decide what to ask next. Handing it too little leaves it guessing.',
      ],
    },
    approach: {
      title: 'Progressive disclosure.',
      paragraphs: [
        'Each call answers one question and points to the next: what is available, what is relevant, and what one record holds.',
      ],
      steps: disclosureSteps.map((step) => ({
        name: step.name,
        title: step.title,
        body: step.copy,
        call: `${step.call.tool}(${step.call.args})`,
      })),
      note: 'The calls are conceptual, not a real API.',
    },
    impact: {
      title: agentContext.result,
      paragraphs: [
        'I designed and piloted MCP tools that help agents and builders discover and use Salesforce metadata.',
        `${makeUsable.copy} ${groundAgents.copy}`,
      ],
      facts: [{ value: mcpTools.status, label: 'MCP tools for Salesforce metadata' }],
    },
    next: {
      title: 'Context, one useful step at a time.',
      paragraphs: [
        'My foundation is backend engineering, distributed systems, and APIs. This work brings that experience to agent-facing tools.',
        'Agent-facing APIs are part of my focus as a principal engineer, alongside the Core Metadata Platform and developer productivity.',
      ],
      link: { label: 'Read about the platform behind it', href: caseStudyPath('platform') },
    },
  },
};

const platform: CaseStudy = {
  id: 'platform',
  theme: theme('platform'),
  summary: `${person.name}’s work on the Core Metadata Platform: a metadata migration that enabled Data 360 scale, Schema Evolution for Marketing Cloud Next, and faster metadata APIs.`,
  parts: {
    problem: {
      title: 'Room to grow, without losing what builders know.',
      paragraphs: [
        'Metadata is the structure that describes data. Data 360 needed more scale from it, and Marketing Cloud Next needed its schemas to stay aligned as products evolve.',
        'Both had to happen without changing what builders rely on: familiar objects and fields, consistent from one product to the next.',
      ],
    },
    approach: {
      title: `${theme('platform').tag}.`,
      paragraphs: [
        'My work there connects three stories: getting useful metadata to agents, building Schema Evolution for Marketing Cloud Next, and leading a metadata migration that enabled Data 360 scale.',
      ],
      steps: [
        {
          name: story('migration').short,
          title: migration.title,
          body: migration.summary,
          status: migration.status,
        },
        {
          name: story('schema').short,
          title: schema.title,
          body: schema.summary,
          status: schema.status,
        },
        { name: performance.status, title: performance.title, body: performance.summary },
        {
          name: agentContext.short,
          title: mcpTools.title,
          body: mcpTools.summary,
          status: mcpTools.status,
          caseStudy: 'mcp',
        },
      ],
    },
    impact: {
      title: story('migration').result,
      paragraphs: [
        `The migration enabled the scale needed by Data 360 while preserving a familiar platform experience for Salesforce builders. It earned me the ${presidentsAward.year} ${presidentsAward.name}, recognition for the top 1% of Salesforce engineers.`,
        'Schema Evolution gives teams a shared foundation for coordinating schema changes, and faster metadata APIs help builders work with complex applications at enterprise scale.',
      ],
      facts: [
        {
          value: 'Top 1%',
          label: `${presidentsAward.year} ${presidentsAward.name}, for leading a major metadata migration`,
        },
        { value: migration.status, label: migration.title },
      ],
    },
    next: {
      title: 'Foundations that let other people do more.',
      paragraphs: [
        `That has been the through line since I joined ${person.company} in ${careerStartYear}, from backend services to platform frameworks.`,
        'The same metadata now gives agents a map of what is available. That is where my MCP work picks up.',
      ],
      link: { label: 'Read about the MCP tools', href: caseStudyPath('mcp') },
    },
  },
};

/** In the order of the Work section. */
export const caseStudies: readonly CaseStudy[] = [devtools, mcp, platform];

export function findCaseStudy(id: string): CaseStudy | undefined {
  return caseStudies.find((study) => study.id === id);
}

/** The case studies before and after this one, in the order of the Work section. */
export function adjacentCaseStudies(id: CaseStudyId): {
  previous?: CaseStudy;
  next?: CaseStudy;
} {
  const index = caseStudies.findIndex((study) => study.id === id);
  return { previous: caseStudies[index - 1], next: caseStudies[index + 1] };
}
