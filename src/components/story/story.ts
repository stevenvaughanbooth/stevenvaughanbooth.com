/**
 * The "How I built this" story, in Steven's voice. Every statement is limited to what happened
 * and what the repository shows: no counts, dates or quotes beyond the ones recorded here.
 */
import { VISITOR_LIMIT } from '@/lib/ask-contract';
import { adage, careerSummary, film } from '@/content/profile';

export type Who = 'me' | 'claude';

export const who: Record<Who, { label: string; dot: string }> = {
  me: { label: 'Me', dot: 'bg-green' },
  claude: { label: 'Claude Code', dot: 'bg-amber' },
};

export interface Stage {
  name: string;
  detail: string;
}

/** The split of the work, drawn at the top of the page: what each side did, then its stages. */
export const roles: Record<
  Who,
  { name: string; jobs: string[]; stagesLabel: string; stages: Stage[] }
> & {
  handoffs: { from: Who; to: Who; what: string }[];
} = {
  me: {
    name: 'Steven Booth',
    jobs: ['Set the goal', 'Made every product call'],
    stagesLabel: 'My sign-off',
    stages: [{ name: 'Approve', detail: 'The preview, before anything reaches production' }],
  },
  claude: {
    name: 'Claude Opus 5.5',
    jobs: ['Planned the work', 'Ran the agents and integrated their work'],
    stagesLabel: 'The agents it ran',
    stages: [
      { name: 'Build', detail: 'Agents in parallel, one branch each' },
      { name: 'Review', detail: 'Independent reviewers, area by area' },
      { name: 'Fix', detail: 'Five fix teams, then a final pass' },
    ],
  },
  handoffs: [
    { from: 'me', to: 'claude', what: 'Goal and calls' },
    { from: 'claude', to: 'me', what: 'A preview to approve' },
  ],
};

/** Steven's brief, quoted as he wrote it. */
export const brief = {
  goal: 'an exemplary site for how to do efficient web development',
  qualities: ['industry standard WOW factors', 'programmed well', 'loads fast', 'ultra intuitive'],
  conditions: [
    {
      title: 'A couple of questions, then email.',
      body: `Each visitor gets ${VISITOR_LIMIT} live questions in any 24 hours. After that, Ask Steven points to my inbox.`,
    },
    {
      title: 'The API key, “ultra protected”.',
      body: 'It never reaches the browser, and bot checks, rate limits and a spend cap bound what anyone can cost me with it.',
    },
  ],
};

export interface TimelineEntry {
  phase: string;
  title: string;
  body: string;
  /** ISO date or local date-time, for <time>. Undated entries happened between their neighbours. */
  at?: string;
  who?: Who;
  chips?: { label: string; items: string[] };
}

/** The day, from the site I started from to production. */
export const timeline: TimelineEntry[] = [
  {
    phase: 'Before',
    at: '2026-10-14',
    title: 'The site I started from',
    body: 'A single static page with a full-screen cinematic intro.',
  },
  {
    phase: 'Plan',
    at: '2026-10-29T13:50',
    who: 'claude',
    title: 'Plans before code',
    body: 'The rebuild started at about 13:50. Claude Code wrote the architecture, UX and content plans up front. The architecture plan survives as docs/architecture.md.',
  },
  {
    phase: 'Build',
    who: 'claude',
    title: 'Agents in parallel',
    body: 'Each agent worked in its own git worktree, on its own branch.',
    chips: {
      label: 'Branches',
      items: [
        'interactive-diagrams',
        'adage-showcase',
        'media-engineer',
        'command-palette',
        'ask-backend',
        'seo-platform',
        'quality-dx',
      ],
    },
  },
  {
    phase: 'Review',
    who: 'claude',
    title: 'Independent review',
    body: 'Independent reviewers went through the first pass, area by area.',
    chips: {
      label: 'Areas',
      items: [
        'UX and design',
        'Accessibility',
        'Performance',
        'Security',
        'Content',
        'Code quality',
      ],
    },
  },
  {
    phase: 'Fix',
    who: 'claude',
    title: 'Five fix teams, then a final pass',
    body: 'The teams worked through the findings. A final pass brought the docs, tests and CI into line with the code.',
    chips: {
      label: 'Teams',
      items: [
        'ask',
        'content-perf',
        'visuals-foundation',
        'visuals-metadata-career',
        'visuals-reflex-film',
      ],
    },
  },
  {
    phase: 'Ship',
    at: '2026-10-30',
    who: 'me',
    title: 'Live, after my approval',
    body: 'I approved the preview before anything went to production. The first pass’s 53 commits were squashed into one before the repository went public.',
  },
];

/** What happened after launch, apart from the day so it never reads as part of what went live. */
export const afterLaunch: TimelineEntry[] = [
  {
    phase: 'Round two',
    at: '2026-10-30',
    who: 'claude',
    title: 'Six features in parallel',
    body: 'Six features were built in parallel, one branch each, then merged for my review.',
    chips: {
      label: 'Features',
      items: [
        'Film in the hero',
        'Signal line',
        'Ask that shows the page',
        'Case studies',
        'This story',
        'Polish',
      ],
    },
  },
];

export interface Finding {
  found: string;
  now: string;
}

/** What independent review caught, by area, and what changed because of it. */
export const findings: { area: string; items: Finding[] }[] = [
  {
    area: 'Security',
    items: [
      {
        found: 'Bot protection let a request through when its own check errored.',
        now: 'It fails closed. No verdict, no answer.',
      },
      {
        found:
          'Everyone behind one shared network, such as an office, would have shared one allowance of questions.',
        now: 'Each visitor has their own allowance in a signed cookie, with a separate cap per network.',
      },
    ],
  },
  {
    area: 'Content',
    items: [
      {
        found: `${adage.name}’s results were stated without their caveats.`,
        now: 'Every number carries its study design and its limits.',
      },
      {
        found: 'The old site’s assistant had internal-sounding search keywords in its source.',
        now: 'They were removed, and the history was squashed before the repository went public.',
      },
    ],
  },
  {
    area: 'Accessibility',
    items: [
      {
        found: 'Navigation links scrolled to a section but left keyboard focus behind.',
        now: 'Focus moves into the section, so the next Tab continues there.',
      },
      {
        found: 'The film’s scene list looked like a dialog but let focus escape behind it.',
        now: 'It is a true modal dialog.',
      },
      {
        found: 'A diagram’s guided tour could change the selected tab under keyboard focus.',
        now: 'A tour holds while focus is inside it, and stops for good once a visitor picks a tab.',
      },
      {
        found: 'Text faded in below contrast as sections scrolled into view.',
        now: 'Sections move but never fade, and axe checks them mid-animation.',
      },
    ],
  },
  {
    area: 'Performance',
    items: [
      {
        found: 'The first build blew its JavaScript budget.',
        now: 'Diagrams render on the server, their code loads as they near view, and the palette loads only when someone reaches for it.',
      },
    ],
  },
];

/** Steven's product calls. */
export const decisions: { call: string; detail: string }[] = [
  {
    call: `Keep the ${film.title} film, but smaller.`,
    detail: 'A part of the page, not a full-screen intro in front of it.',
  },
  {
    call: `Put ${adage.name} up front.`,
    detail: 'My open-source project gets its own section near the top of the page.',
  },
  {
    call: 'Ask Steven, as a ⌘K palette.',
    detail: 'Curated answers first. Claude came later, on my two conditions.',
  },
  {
    call: 'Claude Haiku 5.5 for live answers.',
    detail: 'For cost.',
  },
  {
    call: 'Curated until I add the key.',
    detail: 'Live answers stay off until I configure them myself.',
  },
  {
    call: 'Preview first.',
    detail: 'Nothing reached production until I had approved it.',
  },
  {
    call: 'One clean commit.',
    detail: 'The history was squashed before the repository went public.',
  },
  {
    call: 'My words where they matter.',
    detail: `I kept my own Experience heading over a reviewer’s rewrite: “${careerSummary.title}”`,
  },
  {
    call: 'Six features for round two.',
    detail:
      'The film in the hero, the follow-the-signal line, an Ask that can show you the page, case-study pages, this page, and a layer of polish.',
  },
];
