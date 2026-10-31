/**
 * Curated answers for the Ask Steven palette, built from profile.ts and the original site's guide.
 * They answer instantly and never call a model. Like the live answers, they speak as a guide
 * about Steven, in the third person. The matcher at the end of the file is deterministic: the same
 * question always resolves to the same answer.
 */
import type { Route } from 'next';
import { VISITOR_LIMIT } from '@/lib/ask-contract';
import {
  isPageTargetId,
  type PageTargetId,
  pageTarget,
  roleAnchor,
  targetId,
} from '@/lib/page-targets';
import {
  type Accent,
  adage,
  awards,
  careerStartYear,
  careerSummary,
  describeAward,
  experience,
  person,
  projects,
  type Role,
  sections,
  site,
  type Theme,
  themes,
} from './profile';

/** checking: status unknown · live: questions left · curated: live answers off · exhausted: used up */
export type AskMode = 'checking' | 'live' | 'curated' | 'exhausted';

/** A related link: a route, an https page, or a mailto. Places on this page are actions. */
export interface AnswerLink {
  label: string;
  href: Route | `https://${string}` | `mailto:${string}`;
}

export interface AnswerFact {
  label: string;
  value: string;
}

export interface CuratedAnswer {
  heading?: string;
  paragraphs: string[];
  /** A closing paragraph about live answers, which must stay true in every palette mode. */
  modeNote?: Record<AskMode, string>;
  facts?: AnswerFact[];
  links?: AnswerLink[];
  /**
   * Places on the site that show what the answer is about, offered as buttons ("Show me…"); the
   * first is the main one. They move the page only when pressed, or when the visitor asked to be
   * shown something.
   */
  actions?: PageTargetId[];
  /** Topics offered as natural next questions. */
  followUps?: TopicId[];
}

export type TopicId =
  | 'devtools'
  | 'mcp'
  | 'platform'
  | 'adage'
  | 'migration'
  | 'schema'
  | 'performance'
  | 'c360'
  | 'career'
  | 'awards'
  | 'education'
  | 'stack'
  | 'projects'
  | 'contact'
  | 'github'
  | 'linkedin'
  | 'site'
  | 'about';

export interface Topic extends CuratedAnswer {
  id: TopicId;
  /** Shown in the palette's Topics group. */
  title: string;
  /** Short context shown beside the title. */
  hint: string;
  /** The canonical question; selecting the topic asks it. */
  prompt: string;
  glyph: string;
  accent?: Accent;
  /** Words or phrases that identify the topic on their own (weight 3). */
  names?: string[];
  /**
   * Normalized words or phrases (weight = word count). A trailing * matches a word prefix, so
   * 'optimi*' matches optimize and optimization. One generic word is not enough to answer.
   */
  keywords: string[];
}

function project(id: (typeof projects)[number]['id']) {
  const found = projects.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown project: ${id}`);
  return found;
}

function theme(id: Theme['id']) {
  const found = themes.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown theme: ${id}`);
  return found;
}

/** A theme's diagram on the home page, then its case study, if the allowlist has it. */
const themeActions = (id: Theme['id']) =>
  [targetId(`work-${id}`), `case-study-${id}`].filter(isPageTargetId);

/**
 * Adage's reported results with every caveat profile.ts attaches to them, as one passage, from
 * the evidence record's prose fields, as /llms.txt quotes them. The Claude system prompt uses it
 * too. The record's `results` are the page's cards, which restate the same figures field by field,
 * so they stay out of it: with them, every number and caveat would read twice.
 */
export const adageEvidence = `${adage.evidence.headline}. ${adage.evidence.context} ${adage.evidence.candor}`;

const presidentsAward = awards.find((award) => /president/i.test(award.name));
const c360Award = awards.find((award) => /customer 360/i.test(award.reason));
const c360Role = experience.find((role) => role.focus?.includes('Customer 360'));
const firstRole = experience.at(-1);

const emailLink: AnswerLink = { label: 'Email Steven', href: person.links.email };
const linkedInLink: AnswerLink = { label: 'LinkedIn', href: person.links.linkedin };
const githubLink: AnswerLink = { label: 'GitHub', href: person.links.github };
const adageRepoLink: AnswerLink = { label: 'Adage on GitHub', href: adage.links.repo };

const devtools = theme('devtools');
const mcp = theme('mcp');
const platform = theme('platform');

const curatedLine = 'Preset topics answer instantly from Steven’s curated notes.';
const fallbackLine = 'so other questions get the closest topic, or Steven’s email.';

/** In palette order. Earlier topics also win ties in the matcher. */
export const topics: Topic[] = [
  {
    id: 'devtools',
    title: devtools.kicker,
    hint: devtools.tag,
    prompt: devtools.prompt,
    glyph: '✦',
    accent: devtools.accent,
    heading: devtools.title,
    paragraphs: [
      'Steven is a Productivity Champion and developer tooling advocate. He shares and promotes useful AI tools, skills, and workflows across his organization, helping other engineers put them to work.',
      'His impact is in being a multiplier: a good idea reaches more people, teams build on it, and better ways of working spread.',
    ],
    actions: themeActions('devtools'),
    names: ['productivity champion', 'devtools', 'dev tools', 'developer tooling', 'multiplier'],
    keywords: [
      'dev kits',
      'devkits',
      'tooling',
      'ai tools',
      'ai skills',
      'agent skills',
      'claude skills',
      'claude code',
      'hooks',
      'productivity',
      'champion',
      'advocate',
      'advocacy',
      'adopt*',
      'enablement',
      'workflow',
      'workflows',
      'claude',
      'codex',
      'opencode',
      'hackathon',
      'teams',
    ],
  },
  {
    id: 'mcp',
    title: mcp.kicker,
    hint: mcp.tag,
    prompt: mcp.prompt,
    glyph: '◈',
    accent: mcp.accent,
    heading: 'Context, one useful step at a time.',
    paragraphs: [
      'Steven designed and piloted MCP tools around how agents explore: start with a compact map, search for the relevant metadata, then retrieve the detail.',
      // The same words on the home page and on the case study, which the diagram heads.
      'The MCP diagram steps through how the context narrows.',
    ],
    actions: themeActions('mcp'),
    names: ['mcp', 'model context protocol', 'progressive disclosure'],
    keywords: [
      'api',
      'apis',
      'agent',
      'agents',
      'agentic',
      'agent facing',
      'agent tools',
      'context',
      'retrieval',
      'semantic',
      'embedding',
      'embeddings',
      'grounding',
      'disclosure',
    ],
  },
  {
    id: 'platform',
    title: 'Core Metadata Platform',
    hint: platform.tag,
    prompt: platform.prompt,
    glyph: '▦',
    accent: platform.accent,
    heading: platform.title,
    paragraphs: [
      `${platform.lede} Objects, fields, and relationships give builders the foundations to create and customize applications. Steven’s work on the Core Metadata Platform helps enable a consistent, extensible experience across Salesforce Core, Data 360, and Marketing Cloud Next.`,
      'His work there connects three stories: getting useful metadata to agents, building Schema Evolution for Marketing Cloud Next, and leading a metadata migration that enabled Data 360 scale.',
    ],
    actions: themeActions('platform'),
    followUps: ['migration', 'schema', 'performance'],
    names: ['core metadata platform', 'metadata platform'],
    keywords: [
      'platform',
      'metadata',
      'schema',
      'framework',
      'frameworks',
      'foundation*',
      'extensib*',
      'data 360',
      'data cloud',
      'marketing cloud',
      'scale',
    ],
  },
  {
    id: 'adage',
    title: adage.name,
    hint: 'Open-source agent reflexes',
    prompt: `What is ${adage.name}?`,
    glyph: '◎',
    accent: 'blue',
    heading: adage.tagline,
    paragraphs: [
      adage.summary,
      `The question behind it: “${adage.question}”`,
      `Evidence so far: ${adageEvidence}`,
    ],
    facts: [
      { label: 'Status', value: adage.status },
      { label: 'Language', value: adage.language },
      { label: 'License', value: adage.license },
      { label: 'Works with', value: adage.harnesses.join(', ') },
      { label: 'Install', value: adage.install },
    ],
    links: [
      adageRepoLink,
      { label: 'Project site', href: adage.links.site },
      { label: 'Methods and limitations', href: adage.links.evidence },
    ],
    actions: [targetId('open-source')],
    names: ['adage', 'reflex', 'reflexes'],
    keywords: [
      'open source',
      'opensource',
      'oss',
      'side project',
      'rust',
      'harness',
      'harnesses',
      'session history',
      'instinct*',
      'experiment',
    ],
  },
  {
    id: 'migration',
    title: 'Metadata migration',
    hint: project('migration').status,
    prompt: 'Tell me about the metadata migration',
    glyph: '⇢',
    accent: platform.accent,
    heading: project('migration').title,
    paragraphs: [
      'Steven led a major metadata migration that enabled the scale needed by Data 360 while preserving a familiar platform experience for Salesforce builders.',
      ...(presidentsAward
        ? [
            `It earned him the ${presidentsAward.year} ${presidentsAward.name}. ${presidentsAward.detail}`,
          ]
        : []),
    ],
    actions: themeActions('platform'),
    names: ['metadata migration'],
    keywords: ['migration', 'migrat*'],
  },
  {
    id: 'schema',
    title: 'Schema Evolution',
    hint: project('schema').status,
    prompt: 'What is Schema Evolution?',
    glyph: '≋',
    accent: platform.accent,
    heading: project('schema').title,
    paragraphs: [
      'Steven built the Schema Evolution framework to help keep schemas aligned with Marketing Cloud Next as products evolve. The work gives teams a shared foundation for coordinating schema changes.',
    ],
    actions: themeActions('platform'),
    names: ['schema evolution'],
    keywords: ['evolution', 'evolving schemas', 'marketing cloud next'],
  },
  {
    id: 'performance',
    title: 'API performance',
    hint: project('performance').title,
    prompt: 'How did Steven improve API performance?',
    glyph: '↯',
    accent: platform.accent,
    heading: project('performance').title,
    paragraphs: [
      'Steven improved the performance and efficiency of Salesforce metadata APIs, helping builders work with complex applications at enterprise scale.',
    ],
    actions: themeActions('platform'),
    names: ['api performance'],
    keywords: [
      'performance',
      'improve performance',
      'improved performance',
      'optimi*',
      'efficien*',
      'latency',
      'speed',
      'faster',
    ],
  },
  {
    id: 'c360',
    title: 'Customer 360 Data Manager',
    hint: c360Role ? `${c360Role.start} – ${c360Role.end}` : 'Backend services',
    prompt: 'What did Steven build for Customer 360 Data Manager?',
    glyph: '⌬',
    heading: 'Customer 360 Data Manager',
    paragraphs: [
      'Steven built backend services supporting Customer 360 Data Manager, helping enable connected experiences across Salesforce.',
      ...(c360Award ? [`${c360Award.year} ${c360Award.name}. ${c360Award.reason}`] : []),
    ],
    facts: c360Role
      ? [{ label: `${c360Role.start} – ${c360Role.end}`, value: c360Role.displayTitle }]
      : undefined,
    actions: [targetId(c360Role ? roleAnchor(c360Role) : 'experience')],
    names: ['customer 360 data manager', 'customer 360', 'c360'],
    keywords: ['data manager'],
  },
  {
    id: 'career',
    title: `Career at ${person.company}`,
    hint: firstRole ? `Since ${firstRole.start}` : person.company,
    prompt: 'How has Steven’s career grown?',
    glyph: '↗',
    heading: careerSummary.title,
    paragraphs: [
      `Steven has been at ${person.company} since ${firstRole?.start ?? careerStartYear}. His work has grown from backend services to platform frameworks and the tools that help people and agents build.`,
    ],
    facts: experience.map((role) => ({
      label: `${role.start} – ${role.end}`,
      value: role.displayTitle,
    })),
    actions: [targetId('experience')],
    names: ['career', 'resume', 'cv'],
    keywords: [
      'experience',
      'timeline',
      'history',
      'roles',
      'progression',
      'tenure',
      'years',
      'salesforce',
      'job',
      'promotion',
      'promoted',
      'principal',
    ],
  },
  {
    id: 'awards',
    title: 'Recognition',
    hint: awards.map((award) => award.year).join(' · '),
    prompt: 'What awards has Steven won?',
    glyph: '★',
    accent: 'amber',
    heading: 'Recognition for work that mattered.',
    paragraphs: awards.map((award) => `${award.year} ${award.name}. ${describeAward(award)}`),
    actions: [targetId('recognition')],
    names: ['presidents award', 'all star', 'allstar', 'award', 'awards'],
    keywords: [
      'recognition',
      'recogni*',
      'president',
      'presidents',
      'tmp',
      'trophy',
      'top 1',
      'honors',
    ],
  },
  {
    id: 'education',
    title: 'Education',
    hint: person.education.school,
    prompt: 'Where did Steven study?',
    glyph: '◇',
    paragraphs: [`Steven studied at ${person.education.school}: ${person.education.degree}.`],
    actions: [targetId('experience')],
    names: ['santa clara', 'education', 'university', 'college', 'degree'],
    keywords: ['school', 'scu', 'study', 'studied', 'graduat*'],
  },
  {
    id: 'stack',
    title: 'Skills and stack',
    hint: person.skills.slice(0, 3).join(' · '),
    prompt: 'What languages and technologies does Steven work with?',
    glyph: 'λ',
    heading: 'Backend foundations. Agent-first thinking.',
    paragraphs: [
      person.skills.join(' · '),
      'His foundation is backend engineering, distributed systems, and APIs. Recent work brings that experience to agent-facing tools.',
    ],
    names: ['tech stack', 'languages', 'technologies', 'programming languages'],
    keywords: [
      'skills',
      'his skills',
      'your skills',
      'stevens skills',
      'language',
      'stack',
      'technology',
      'tech',
      'java',
      'python',
      'sql',
      'grpc',
      'kubernetes',
      'postgres*',
      'distributed systems',
      'backend',
      'programming',
    ],
  },
  {
    id: 'projects',
    title: 'What Steven builds',
    hint: 'Three ideas, one experiment',
    prompt: 'What has Steven built?',
    glyph: '◫',
    heading: 'Three ideas he keeps building on.',
    paragraphs: [
      'Help better workflows take hold across teams. Give agents the right context. Build foundations that other people can extend.',
      `On the open-source side, ${adage.name} is his experiment in learning the repeatable parts of agent work.`,
    ],
    actions: [targetId('work')],
    followUps: ['devtools', 'mcp', 'platform', 'adage'],
    keywords: [
      'project',
      'projects',
      'portfolio',
      'shipped',
      'built',
      'ideas',
      'he build*',
      'you build*',
      'steven build*',
      'has he built',
      'has steven built',
      'have you built',
      'did he build',
      'did steven build',
      'did you build',
    ],
  },
  {
    id: 'contact',
    title: 'Get in touch',
    hint: person.email,
    prompt: 'How can I reach Steven?',
    glyph: '@',
    paragraphs: [
      'You can reach Steven by email or connect on LinkedIn. His work is focused on backend platforms, distributed systems, and agent tooling.',
    ],
    links: [emailLink, linkedInLink],
    actions: [targetId('contact')],
    names: [
      'contact',
      'email',
      'hire',
      'hiring',
      'recruiter',
      'recruiting',
      'interview',
      'get in touch',
    ],
    keywords: [
      'recruit*',
      'reach you',
      'reach steven',
      'reach him',
      'connect with you',
      'connect with steven',
      'connect with him',
    ],
  },
  {
    id: 'github',
    title: 'GitHub',
    hint: 'Public repositories',
    prompt: 'Where is Steven’s code?',
    glyph: '</>',
    paragraphs: [
      `Explore Steven’s public GitHub profile. ${adage.name} is his open-source experiment there; this guide does not make claims about other repositories.`,
    ],
    links: [githubLink, adageRepoLink],
    names: ['github'],
    keywords: [
      'repository',
      'repositories',
      'repo',
      'repos',
      'code samples',
      'source code',
      'open source code',
    ],
  },
  {
    id: 'linkedin',
    title: 'LinkedIn',
    hint: 'Connect',
    prompt: 'Is Steven on LinkedIn?',
    glyph: 'in',
    paragraphs: ['Connect with Steven on LinkedIn.'],
    links: [linkedInLink],
    names: ['linkedin'],
    keywords: [],
  },
  {
    id: 'site',
    title: 'How this site is built',
    hint: 'Colophon',
    prompt: 'How is this site built?',
    glyph: '{}',
    paragraphs: [
      'This site is a statically prerendered Next.js app with typed content, Tailwind CSS design tokens, and small client islands for the interactive pieces.',
    ],
    modeNote: {
      live: 'Ask Steven answers preset topics instantly from curated notes. Other questions go to Claude through a rate-limited server route, and the API key never reaches the browser.',
      checking:
        'Ask Steven answers preset topics instantly from curated notes. When live answers are on, other questions go to Claude through a rate-limited server route, and the API key never reaches the browser.',
      curated:
        'Ask Steven answers preset topics instantly from curated notes. Live answers from Claude are off right now; when they are on, questions go through a rate-limited server route, and the API key never reaches the browser.',
      exhausted: `Ask Steven answers preset topics instantly from curated notes. Other questions go to Claude through a rate-limited server route, ${VISITOR_LIMIT} a day per visitor, and this browser has used its share for now. The API key never reaches the browser.`,
    },
    links: [
      { label: 'How I built this', href: '/colophon' },
      { label: 'Source on GitHub', href: site.repo },
    ],
    names: ['colophon', 'this site', 'this website', 'ask steven'],
    keywords: ['website', 'next js', 'nextjs', 'tailwind', 'built with', 'palette'],
  },
  {
    id: 'about',
    title: `About ${person.givenName}`,
    hint: `${person.shortRole}, ${person.location}`,
    prompt: `Who is ${person.name}?`,
    glyph: '●',
    accent: 'green',
    heading: person.tagline,
    paragraphs: [
      `${person.name} is a ${person.role} at ${person.company}, based in ${person.location}.`,
      'He likes hard problems and ideas that make him want to open his editor. He is a Productivity Champion and developer tooling advocate, very tapped into new models and features, and he helps useful tools and workflows take hold across his organization.',
      `In his words: “${person.builderNote.title}”`,
    ],
    followUps: ['devtools', 'mcp', 'platform'],
    keywords: [
      'about you',
      'about yourself',
      'about steven',
      'about him',
      'who is steven',
      'who is he',
      'who are you',
      'yourself',
      'builder',
      'introduce',
      'introduction',
      'background',
    ],
  },
];

/** Shown for empty searches, before anything is typed. */
export const featuredTopicIds: TopicId[] = [
  'devtools',
  'mcp',
  'platform',
  'adage',
  'career',
  'awards',
];

/** A place on the site, as a request a visitor might type. */
const showMe = (id: string) => `Show me ${pageTarget(targetId(id))?.label ?? id}`;

/**
 * Suggested questions under the hero's ask bar: one open-source topic, one theme's own question,
 * and one request that moves the page, so the first thing a visitor tries shows what Ask can do.
 */
export const heroSuggestions: string[] = [
  `What is ${adage.name}?`,
  themes.find((theme) => theme.id === 'mcp')?.prompt ?? 'How do you design APIs for agents?',
  showMe('work-platform'),
];

export const helpAnswer: CuratedAnswer = {
  heading: 'Follow your curiosity.',
  paragraphs: [
    'Ask about Adage, agent APIs, the Core Metadata Platform, Steven’s career, or his awards. You can also jump to any section or open GitHub and LinkedIn.',
  ],
  modeNote: {
    live: `${curatedLine} Other questions go to Claude, which answers from Steven’s public profile, with ${VISITOR_LIMIT} live questions per visitor a day.`,
    checking: `${curatedLine} When live answers are on, other questions go to Claude, with a few per visitor a day.`,
    curated: `${curatedLine} Live answers are off right now, ${fallbackLine}`,
    exhausted: `${curatedLine} This browser has used its live questions for now, ${fallbackLine}`,
  },
  followUps: ['devtools', 'mcp', 'platform', 'adage'],
};

export const privateAnswer: CuratedAnswer = {
  paragraphs: [
    'This guide covers only the career and project details Steven has chosen to share publicly. Ask about his platform work, agent tooling, experience or public links.',
    'For anything else, email Steven directly.',
  ],
  links: [emailLink],
};

export const promptAnswer: CuratedAnswer = {
  paragraphs: [
    'The guide’s system prompt is public. It is built from the same profile as the rest of this site and lives in src/lib/ask/prompt.ts in the site’s source.',
  ],
  links: [
    { label: 'Read prompt.ts', href: `${site.repo}/blob/main/src/lib/ask/prompt.ts` },
    { label: 'How I built this', href: '/colophon' },
  ],
};

export const fallbackAnswer: CuratedAnswer = {
  paragraphs: [
    'That isn’t covered in Steven’s curated notes. They cover Adage, his MCP work, the Core Metadata Platform, the metadata migration, API performance, his career and his awards. For anything else, email Steven.',
  ],
  links: [emailLink],
  followUps: ['projects', 'adage', 'career'],
};

export function topicById(id: TopicId): Topic {
  const found = topics.find((topic) => topic.id === id);
  if (!found) throw new Error(`Unknown topic: ${id}`);
  return found;
}

/** The answer as it reads in the given mode, with its live-answers note resolved. */
export function answerFor(answer: CuratedAnswer, mode: AskMode): CuratedAnswer {
  if (!answer.modeNote) return answer;
  const { modeNote, ...rest } = answer;
  return { ...rest, paragraphs: [...rest.paragraphs, modeNote[mode]] };
}

/** A career role, for "show me his principal role": its title, dates and focus, from profile.ts. */
function roleAnswer(role: Role): CuratedAnswer {
  return {
    heading: role.displayTitle,
    paragraphs: [
      `${role.title} at ${person.company}, ${role.start} to ${role.end}.`,
      ...(role.focus ? [`Focus: ${role.focus}`] : []),
    ],
    actions: [targetId(roleAnchor(role))],
    followUps: ['career'],
  };
}

// ---------------------------------------------------------------------------------------------
// Matcher

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Private or manipulative requests get a fixed refusal and never reach a model. Kept narrow so
 * questions about public content (Adage's privacy, the published promotions) still get answers.
 */
const privatePatterns = [
  /ignore .*(instruction|rule|prompt)/,
  /\bapi key/,
  /\bpasswords?\b/,
  /salary/,
  /compensation/,
  /\b(paid|equity)\b/,
  /\bstock/,
  /\brsus?\b/,
  /\bbonus/,
  /net worth/,
  /promotion (packet|decision|case|committee)/,
  /(your|his|stevens) (manager|boss|skip level)/,
  /management chain/,
  /\bboss\b/,
  /\b(do|does) (he|steven|you) report to\b/,
  /\b(he|steven) reports to\b/,
  /performance (review|rating)/,
  /\bprivate (life|matters|details|information)\b/,
  /\bpersonal life\b/,
  /home address/,
  /phone number/,
  /\binternal (system|tool|detail|doc|code|roadmap|project)s?\b/,
  /\b(salesforce|product) roadmap/,
  /\bconfidential/,
  /\b(leav(e|es|ing)|quit(s|ting)?) salesforce\b/,
  /why (is|would) (he|steven) leave/,
  /why (is )?(he|steven) leaving/,
];

/** Questions about the guide's own instructions: they are public, so say where. */
const promptPatterns = [/\bsystem prompt\b/, /\byour (prompt|instructions)\b/];

const helpQueries = new Set([
  'help',
  'commands',
  'menu',
  'options',
  'what can i ask',
  'hi',
  'hi there',
  'hello',
  'hello there',
  'hey',
  'hey there',
]);

/** Below this a keyword match is only a hint ("Did you mean…"), never an answer. */
const MIN_SCORE = 2;

export type MatchResult =
  | { kind: 'topic'; topic: Topic; answer: CuratedAnswer; score: number; exact: boolean }
  | { kind: 'help' | 'private' | 'prompt'; answer: CuratedAnswer }
  /** An explicit request to be shown something on the site. `target` is the answer's first action. */
  | { kind: 'show'; target: PageTargetId; answer: CuratedAnswer }
  /** No confident match. Suggestions are topics the question touched on, best first. */
  | { kind: 'none'; answer: CuratedAnswer; suggestions: TopicId[] };

function hits(text: string, keyword: string): boolean {
  if (keyword.endsWith('*')) return text.includes(` ${keyword.slice(0, -1)}`);
  return text.includes(` ${keyword} `);
}

/** Keyword score of one topic for an already-normalized question. */
export function keywordScore(topic: Topic, normalized: string): number {
  const text = ` ${normalized} `;
  let score = normalized === topic.id ? 3 : 0;
  for (const name of topic.names ?? []) if (hits(text, name)) score += 3;
  for (const keyword of topic.keywords) {
    if (hits(text, keyword)) score += keyword.split(' ').length;
  }
  return score;
}

/**
 * "Show me…", "take me to…", "open…": the only phrasings that may move the page without a press.
 * "open" is a verb only when it is not the start of "open source".
 */
const navigationRequest =
  /^(?:(?:can|could|would|will) you |please )*(?:show(?: me)?|take me to|bring me to|bring up|go to|jump to|skip to|scroll to|navigate to|point me to|open(?! source\b))\b ?/;

/** Whether a question asks to be shown something, rather than told about it. */
export function isNavigationRequest(raw: string): boolean {
  return navigationRequest.test(normalize(raw));
}

const wordCount = (phrase: string) => phrase.split(' ').length;

/** Each role by its titles, e.g. "principal engineer", and by its first word alone ("lead"). */
const roleNames = experience.map((role) => {
  const display = normalize(role.displayTitle);
  const first = display.split(' ')[0] ?? display;
  const names = [display, normalize(role.title)];
  if (first !== 'member') names.push(first);
  if (role.end === 'Present') names.push('current role', 'current job');
  return { role, names };
});

/**
 * The place a navigation request asks for: a role by name; else the best-matching topic's first
 * action (or its case study, when one is asked for), at any confidence, since the verb has already
 * said what kind of question this is; else a section by name. Null when nothing fits, so the
 * question is answered as an ordinary one.
 */
function navigation(normalized: string): { target: PageTargetId; answer: CuratedAnswer } | null {
  const match = navigationRequest.exec(normalized);
  if (!match) return null;
  const rest = normalized.slice(match[0].length);
  const text = ` ${rest} `;
  if (!rest) return null;

  // The longest title wins: "principal member of technical staff" over "member of technical staff".
  const role = roleNames
    .map(({ role, names }) => ({
      role,
      score: Math.max(0, ...names.filter((name) => hits(text, name)).map(wordCount)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.role;
  if (role) return { target: targetId(roleAnchor(role)), answer: roleAnswer(role) };

  const caseStudy = /\bcase stud(?:y|ies)\b/.test(rest);
  // The best topic decides, even when it has no place to show ("show me how this site is built").
  const topic = topics
    .map((candidate) => ({ topic: candidate, score: keywordScore(candidate, rest) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.topic;
  const actions = topic?.actions ?? [];
  const pick = caseStudy
    ? actions.find((id) => pageTarget(id)?.kind === 'case-study')
    : actions.find((id) => pageTarget(id)?.kind !== 'case-study');
  const target = pick ?? actions[0];
  if (topic && target) {
    return {
      target,
      answer: { ...topic, actions: [target, ...actions.filter((id) => id !== target)] },
    };
  }

  const section = sections.find(
    (candidate) => isPageTargetId(candidate.id) && hits(text, normalize(candidate.label)),
  );
  if (section) {
    const id = targetId(section.id);
    // The topic that leads with this section answers for it, e.g. Work → "What Steven builds".
    const owner = topics.find((candidate) => candidate.actions?.[0] === id);
    return {
      target: id,
      answer: owner ?? {
        paragraphs: [`Here is ${pageTarget(id)?.label} on this page.`],
        actions: [id],
      },
    };
  }
  return null;
}

function isExact(topic: Topic, normalized: string): boolean {
  return (
    normalized === topic.id ||
    normalized === normalize(topic.prompt) ||
    normalized === normalize(topic.title)
  );
}

/**
 * Resolves a question to a curated answer. Help first, then private requests, then questions
 * about the prompt, then requests to be shown something, then a topic's own phrasing, then the highest-scoring topic (ties go to the
 * earlier topic), but only when the match is confident: a name or at least two keyword points.
 * Anything weaker returns the fallback with the near misses as suggestions. Pure and
 * deterministic.
 */
export function matchQuestion(raw: string): MatchResult {
  const normalized = normalize(raw);
  if (raw.trim() === '?' || helpQueries.has(normalized) || normalized.includes('what can i ask')) {
    return { kind: 'help', answer: helpAnswer };
  }
  if (privatePatterns.some((pattern) => pattern.test(normalized))) {
    return { kind: 'private', answer: privateAnswer };
  }
  if (promptPatterns.some((pattern) => pattern.test(normalized))) {
    return { kind: 'prompt', answer: promptAnswer };
  }
  const shown = navigation(normalized);
  if (shown) return { kind: 'show', ...shown };

  const exact = topics.find((topic) => isExact(topic, normalized));
  if (exact) {
    const score = keywordScore(exact, normalized);
    return { kind: 'topic', topic: exact, answer: exact, score, exact: true };
  }

  const scored = topics
    .map((topic) => ({ topic, score: keywordScore(topic, normalized) }))
    .filter((entry) => entry.score > 0)
    // Stable sort: equal scores keep palette order.
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= MIN_SCORE) {
    return {
      kind: 'topic',
      topic: best.topic,
      answer: best.topic,
      score: best.score,
      exact: false,
    };
  }
  return {
    kind: 'none',
    answer: fallbackAnswer,
    suggestions: scored.slice(0, 3).map((entry) => entry.topic.id),
  };
}
