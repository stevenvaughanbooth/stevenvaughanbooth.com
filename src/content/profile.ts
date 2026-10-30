/**
 * The single source of truth for every fact on the site.
 *
 * Pages, the Ask Steven guide, the Claude system prompt, /profile.json, /llms.txt and the
 * JSON-LD all read from here. Career statements are supplied by Steven; Adage facts come from
 * its public README and evidence page. Do not add claims that are not backed by one of those
 * sources.
 *
 * Voice: page copy speaks as Steven (`headline`, `summary`, `lede`, `body`). The `about` fields
 * restate the same facts in the third person for machine-readable surfaces (/llms.txt,
 * /profile.json), where an unattributed "I" would be ambiguous.
 */

export type Accent = 'green' | 'amber' | 'lilac' | 'blue';

export interface Role {
  title: string;
  displayTitle: string;
  start: string;
  end: string;
  focus?: string;
}

export interface Theme {
  id: 'devtools' | 'mcp' | 'platform';
  index: string;
  kicker: string;
  tag: string;
  accent: Accent;
  title: string;
  lede: string;
  body: string;
  /** The theme in the third person. */
  about: string;
  proof: string;
  prompt: string;
}

export interface Award {
  id: 'presidents-award' | 'tmp-all-star';
  name: string;
  year: string;
  /** What the award recognizes. Empty when only the reason is public. */
  detail: string;
  reason: string;
}

export interface Link {
  label: string;
  href: string;
}

export const site = {
  url: 'https://stevenvaughanbooth.com',
  domain: 'stevenvaughanbooth.com',
  title: 'Steven Booth — Principal Software Engineer',
  description:
    'Steven Booth is a principal engineer at Salesforce building platform foundations, agent-facing APIs and MCP tools, and the workflows that help engineers build with AI.',
  repo: 'https://github.com/stevenvaughanbooth/stevenvaughanbooth.com',
} as const;

export const person = {
  name: 'Steven Booth',
  givenName: 'Steven',
  familyName: 'Booth',
  role: 'Principal Software Engineer',
  shortRole: 'Principal Engineer',
  company: 'Salesforce',
  location: 'San Francisco, CA',
  email: 'stevenvaughanbooth@gmail.com',
  tagline: 'Engineer. Builder. Curious by default.',
  headline:
    'I build the platforms behind the product, and the tools that help people and agents build what’s next.',
  introduction:
    'I am a builder, a Productivity Champion, and a developer tooling advocate. I build platform foundations and help better tools and workflows take hold across my organization.',
  /** `headline` and `introduction` in the third person. */
  about: {
    headline:
      'Steven builds the platforms behind the product, and the tools that help people and agents build what’s next.',
    introduction:
      'Steven is a builder, a Productivity Champion, and a developer tooling advocate. He builds platform foundations and helps better tools and workflows take hold across his organization.',
  },
  builderNote: {
    title: 'I am a builder. Always have been.',
    body: 'I like hard problems, especially when there’s room for an approach that isn’t obvious. I’m first in line to try new models and features in my own workflows. A lot has changed. It’s only made me more eager to build.',
  },
  education: {
    school: 'Santa Clara University',
    degree: 'B.S. Computer Science & Engineering',
  },
  links: {
    email: 'mailto:stevenvaughanbooth@gmail.com',
    github: 'https://github.com/stevenvaughanbooth',
    linkedin: 'https://www.linkedin.com/in/steven-booth-a50a28b5/',
  },
  skills: [
    'Java',
    'Python',
    'SQL',
    'Distributed Systems',
    'API Design',
    'MCP',
    'gRPC',
    'Kubernetes',
    'PostgreSQL',
  ],
} as const;

/** Salesforce career, most recent first. */
export const experience: Role[] = [
  {
    title: 'Principal Member of Technical Staff',
    displayTitle: 'Principal Engineer',
    start: 'Aug 2024',
    end: 'Present',
    focus: 'Core Metadata Platform, agent-facing APIs, and developer productivity.',
  },
  {
    title: 'Lead Member of Technical Staff',
    displayTitle: 'Lead Engineer',
    start: 'Feb 2022',
    end: 'Aug 2024',
    focus: 'Extensible platform foundations and major metadata initiatives.',
  },
  {
    title: 'Senior Member of Technical Staff',
    displayTitle: 'Senior Engineer',
    start: 'Feb 2020',
    end: 'Feb 2022',
    focus: 'Backend services supporting Customer 360 Data Manager.',
  },
  {
    title: 'Member of Technical Staff',
    displayTitle: 'Member of Technical Staff',
    start: 'May 2019',
    end: 'Feb 2020',
  },
  {
    title: 'Associate Member of Technical Staff',
    displayTitle: 'Associate Engineer',
    start: 'Aug 2018',
    end: 'May 2019',
  },
];

/**
 * Page sections in reading order. Navigation, the 404 page, the Ask palette and /llms.txt derive
 * their links from this list, so a section id lives in exactly one place.
 */
export const sections = [
  { id: 'open-source', label: 'Open source', nav: true },
  { id: 'work', label: 'Work', nav: true },
  { id: 'film', label: 'Film', nav: false },
  { id: 'experience', label: 'Experience', nav: true },
  { id: 'contact', label: 'Contact', nav: true },
] as const;

export type SectionId = (typeof sections)[number]['id'];

/** The awards block inside Experience keeps its own anchor, so /#recognition links still land. */
export const recognitionAnchor = 'recognition';

export const careerStartYear = 2018;

export const careerSummary = {
  title: 'Same curiosity. Increasing scope.',
  body: 'Growing with Salesforce since 2018. The through line: building foundations that let other people do more.',
} as const;

/** The Work section's heading. The scope line says plainly what the three themes cover. */
export const workIntro = {
  label: 'Three ideas I keep building on',
  title: 'Better tools. Bigger possibilities.',
  scope:
    'Developer productivity in my organization, MCP tools for agents, and Core Metadata Platform foundations for Salesforce Core, Data 360, and Marketing Cloud Next.',
} as const;

/** The three ideas featured in the Work section, each with an interactive diagram. */
export const themes: Theme[] = [
  {
    id: 'devtools',
    index: '01',
    kicker: 'A multiplier for builders',
    tag: 'Productivity Champion',
    accent: 'amber',
    title: 'Better workflows. Stronger teams.',
    lede: 'I’m a Productivity Champion and developer tooling advocate.',
    body: 'I’m very tapped into how AI can improve the way we work, and I help that translate into everyday practice across my organization. I share what works, promote useful tools and workflows, and help other engineers make them their own.',
    about:
      'Steven is a Productivity Champion and developer tooling advocate. He helps AI-assisted ways of working translate into everyday practice across his organization: he shares what works, promotes useful tools and workflows, and helps other engineers make them their own.',
    proof:
      'The multiplier is in the adoption: a useful idea spreads, teams build on it, and more people benefit.',
    prompt: 'How do you help teams adopt better workflows?',
  },
  {
    id: 'mcp',
    index: '02',
    kicker: 'MCP + agent-optimized APIs',
    tag: 'Context, with intent',
    accent: 'green',
    title: 'Give an agent a map. Then let it explore.',
    lede: 'A useful interface helps an agent decide what to ask next.',
    body: 'I design MCP tools around progressive disclosure: discover the landscape, find what matters, then retrieve the detail. Enough context to move forward, with a clear path to more.',
    about:
      'A useful interface helps an agent decide what to ask next. Steven designs MCP tools around progressive disclosure: discover the landscape, find what matters, then retrieve the detail, giving an agent enough context to move forward with a clear path to more.',
    proof:
      'I designed and piloted MCP tools that help agents and builders discover and use Salesforce metadata.',
    prompt: 'How do you design APIs for agents?',
  },
  {
    id: 'platform',
    index: '03',
    kicker: 'Core Metadata Platform',
    tag: 'Foundations for builders',
    accent: 'lilac',
    title: 'A shared foundation. More room to build.',
    lede: 'Metadata is at the center of Salesforce.',
    body: 'Objects, fields, and relationships give builders the foundations to create and customize applications. My work on the Core Metadata Platform helps enable a consistent, extensible experience across Salesforce Core, Data 360, and Marketing Cloud Next.',
    about:
      'Metadata is at the center of Salesforce: objects, fields, and relationships give builders the foundations to create and customize applications. Steven’s work on the Core Metadata Platform helps enable a consistent, extensible experience across Salesforce Core, Data 360, and Marketing Cloud Next.',
    proof:
      'Follow the story from metadata to agent context, through evolving schemas, and into a foundation for greater scale.',
    prompt: 'Tell me about the Core Metadata Platform',
  },
];

/** Individual projects, referenced by the guide and the structured profile. */
export const projects = [
  {
    id: 'mcp',
    title: 'Metadata tools for agents',
    status: 'Piloted',
    summary:
      'Designed and piloted MCP tools that help agents and builders discover and use Salesforce metadata. My API design emphasizes progressive disclosure: start with the big picture, find relevant information, then explore the detail.',
    about:
      'Designed and piloted MCP tools that help agents and builders discover and use Salesforce metadata. His API design emphasizes progressive disclosure: start with the big picture, find relevant information, then explore the detail.',
  },
  {
    id: 'migration',
    title: 'A metadata migration enabling Data 360 scale',
    status: 'Shipped',
    summary:
      'I led a major metadata migration that enabled the scale needed by Data 360 while preserving a familiar platform experience for Salesforce builders.',
    about:
      'Led a major metadata migration that enabled the scale needed by Data 360 while preserving a familiar platform experience for Salesforce builders.',
  },
  {
    id: 'performance',
    title: 'Faster experiences for builders',
    status: 'API performance',
    summary:
      'Improved the performance and efficiency of Salesforce metadata APIs, helping builders work with complex applications at enterprise scale.',
    about:
      'Improved the performance and efficiency of Salesforce metadata APIs, helping builders work with complex applications at enterprise scale.',
  },
  {
    id: 'platform',
    title: 'Core Metadata Platform',
    status: 'Platform engineering',
    summary:
      'Build extensible metadata foundations that help builders create and customize applications across Salesforce Core, Data 360, and Marketing Cloud Next.',
    about:
      'Builds extensible metadata foundations that help builders create and customize applications across Salesforce Core, Data 360, and Marketing Cloud Next.',
  },
  {
    id: 'schema',
    title: 'Schema Evolution for Marketing Cloud Next',
    status: 'Framework development',
    summary:
      'I built the Schema Evolution framework to help keep schemas aligned with Marketing Cloud Next as products evolve. The work gives teams a shared foundation for coordinating schema changes.',
    about:
      'Built the Schema Evolution framework to help keep schemas aligned with Marketing Cloud Next as products evolve. The work gives teams a shared foundation for coordinating schema changes.',
  },
  {
    id: 'devtools',
    title: 'A multiplier for builders',
    status: 'Productivity Champion',
    summary:
      'As a Productivity Champion and developer tooling advocate, I share and promote useful AI tools, skills, and workflows throughout my organization. My impact is helping other engineers adopt better ways of working and build on what each other learns.',
    about:
      'As a Productivity Champion and developer tooling advocate, Steven shares and promotes useful AI tools, skills, and workflows throughout his organization. His impact is helping other engineers adopt better ways of working and build on what each other learns.',
  },
] as const;

export const awards: Award[] = [
  {
    id: 'presidents-award',
    name: 'President’s Award',
    year: 'FY24',
    detail: 'Recognition for the top 1% of Salesforce engineers.',
    reason: 'Awarded for leading a major metadata migration.',
  },
  {
    id: 'tmp-all-star',
    name: 'TMP All-Star Award',
    year: 'FY21',
    detail: '',
    reason: 'Recognized for contributions to Customer 360 Data Manager’s launch.',
  },
];

/** An award's description as one sentence or two: what it recognizes, then why. */
export function describeAward(award: Award): string {
  return [award.detail, award.reason].filter(Boolean).join(' ');
}

function award(id: Award['id']): Award {
  const found = awards.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown award: ${id}`);
  return found;
}

/**
 * Adage's results, each quoted with the caveats its evidence page attaches
 * (https://github.com/stevenvaughanbooth/adage/blob/main/docs/benchmarks.md). A number never
 * appears without its caveat.
 */
const adageResults = [
  {
    value: '48%',
    label: 'fewer model requests',
    study: 'Claude Code mod prototype',
    detail:
      'Versus the agent alone, with 22% lower reported API cost and all 12 runs passing hidden checks in both arms.',
    caveat:
      'Development evidence, not a held-out result: run 4 reused six sandbox tasks after fixes informed by runs 1–3 (12 runs per arm, Claude Sonnet 5.5). The deeper mod prototype supplied approved steps; Adage’s default command hooks cut requests by about 14% in the same study.',
  },
  {
    value: '22%',
    label: 'fewer model requests',
    study: 'Held-out advisory comparison',
    detail: 'Versus the agent alone, with 19 of 20 runs passing hidden checks in each arm.',
    caveat: 'Claude Haiku 4.5 on four tasks repeated five times, not twenty independent tasks.',
  },
] as const;

const [modPrototype, heldOutAdvisory] = adageResults;

/**
 * Adage: Steven's open-source experiment. Every statement here is taken from the project's
 * public README (https://github.com/stevenvaughanbooth/adage). Keep caveats attached to numbers.
 */
export const adage = {
  name: 'Adage',
  tagline: 'Learn the repeatable parts of agent work. Reuse them next time.',
  summary:
    'An experiment in a harness that learns from experience. Adage reads the session history coding agents already leave on your machine, finds recurring steps, and makes them available in later sessions as reflexes: a condition, a response, and the evidence behind it.',
  question: 'Which parts of an agent’s work should it have to reason through again?',
  status: 'Experimental',
  language: 'Rust',
  license: 'Apache-2.0',
  harnesses: ['Claude Code', 'Codex', 'OpenCode'],
  install: 'npm install -g @adage-sh/cli',
  links: {
    repo: 'https://github.com/stevenvaughanbooth/adage',
    site: 'https://adage-site-bice.vercel.app',
    evidence: 'https://github.com/stevenvaughanbooth/adage/blob/main/docs/benchmarks.md',
  },
  /** The README's worked example of a reflex. */
  example: {
    condition:
      'An agent repeatedly tries a test command that bypasses the repository’s setup, and it fails.',
    response: 'Offer the command the history shows works: make test.',
    evidence: 'Earlier sessions in this repository where make test succeeded.',
  },
  pipeline: [
    'Read local history',
    'Find recurring behavior',
    'Keep the evidence attached',
    'Match during work',
  ],
  principles: [
    'History stays local. Normal learning and matching do not send transcripts to a model or service.',
    'The learner is deterministic: the same recorded evidence produces the same result.',
    'Guidance is the starting point. Running commands for the agent is a separate, approved choice.',
  ],
  evidence: {
    /** For the page: one figure per study, each with its caveat directly beneath. */
    results: adageResults,
    /** For prose surfaces (palette, prompt, /llms.txt): always followed by `context`. */
    headline: `${modPrototype.value} ${modPrototype.label} and 22% lower reported API cost`,
    context: `${modPrototype.study} versus the agent alone, with all 12 runs passing hidden checks in both arms. ${modPrototype.caveat} In a held-out advisory comparison, Adage used about ${heldOutAdvisory.value} ${heldOutAdvisory.label}, with 19 of 20 runs passing hidden checks in each arm: ${heldOutAdvisory.caveat}`,
    candor:
      'The evidence page also publishes negative results, including an execution mode that failed its own quality rule.',
  },
} as const;

const and = new Intl.ListFormat('en', { type: 'conjunction' });

/** The hero's proof strip: four facts a reader can check against the rest of the page. */
export const highlights = [
  {
    value: 'Top 1%',
    label: `of Salesforce engineers · ${award('presidents-award').year} ${award('presidents-award').name}`,
  },
  {
    value: 'Principal',
    label: `associate to principal at ${person.company} since ${careerStartYear}`,
  },
  { value: 'MCP tools', label: 'designed and piloted for Salesforce metadata' },
  {
    value: adage.name,
    label: `open-source reflexes for ${and.format(adage.harnesses)}`,
  },
] as const;

/** Public product references that ground Salesforce terminology. */
export const publicReferences: Link[] = [
  {
    label: 'Salesforce metadata overview',
    href: 'https://developer.salesforce.com/docs/platform/salesforce-large-data-volumes-bp/guide/ldv-deployments-concepts-multitenancy-and-metadata.html',
  },
  {
    label: 'Salesforce DX MCP tools',
    href: 'https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-mcp-use-core-tools.html',
  },
  {
    label: 'Marketing Cloud Next and Data 360',
    href: 'https://developer.salesforce.com/docs/marketing/marketing-cloud-growth/guide/mc-resources-documentation.html',
  },
];

export const disclaimer =
  'High-level career statements supplied by Steven Booth. Product terminology is aligned with public Salesforce documentation. Diagrams illustrate concepts, not an internal system design.';

/** The optional inline film. */
export const film = {
  title: 'Arrival',
  kicker: 'Interlude',
  heading: 'Follow the signal.',
  body: 'From the city. Into the workspace.',
  duration: '16 seconds · soundless',
  note: 'An illustrative, AI-generated San Francisco journey. The tower and skyline are not faithful architectural footage.',
} as const;
