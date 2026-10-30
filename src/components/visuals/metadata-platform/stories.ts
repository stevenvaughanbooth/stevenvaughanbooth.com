import type { Theme } from '@/content/profile';

/**
 * Copy for the Core Metadata Platform stories, carried over from the previous site. Each story
 * moves through three phases: at the source, through the platform, into the target. Steven's
 * contribution to a story is the matching project in profile.ts.
 */

export type StoryId = 'agents' | 'schema' | 'migration';

export interface Phase {
  label: string;
  copy: string;
}

export interface Story {
  id: StoryId;
  project: 'mcp' | 'schema' | 'migration';
  /** The Work theme that already tells the project's story: the card links there instead. */
  theme?: Theme['id'];
  short: string;
  title: string;
  phases: readonly [Phase, Phase, Phase];
  /** Shown in the diagram once the story reaches its last phase. */
  result: string;
  /** What the diagram shows, for screen readers. */
  description: string;
}

export const stories: readonly Story[] = [
  {
    id: 'agents',
    project: 'mcp',
    theme: 'mcp',
    short: 'Agent context',
    title: 'From metadata to agent context.',
    phases: [
      {
        label: 'Extract',
        copy: 'Objects, fields, and relationships describe Salesforce Core. Extracting that metadata gives agents a map of what is available.',
      },
      {
        label: 'Make usable',
        copy: 'The Core Metadata Platform provides shared meaning. MCP tools make that structure discoverable and usable by agents.',
      },
      {
        label: 'Ground agents',
        copy: 'The extracted shape becomes agent context: which objects exist, which fields they have, and how they relate.',
      },
    ],
    result: 'Product context, ready for agents.',
    description:
      'Illustrative metadata from Salesforce Core (object Account, field Industry, relationship Owner) passes through the Core Metadata Platform and its MCP tools (discover, understand, use) and arrives as usable agent context.',
  },
  {
    id: 'schema',
    project: 'schema',
    short: 'Schema Evolution',
    title: 'Evolving schemas. Shared meaning.',
    phases: [
      {
        label: 'A change',
        copy: 'An illustrative new field extends a schema. The platform and Marketing Cloud Next need a consistent understanding of that change.',
      },
      {
        label: 'Coordinate',
        copy: 'Schema Evolution coordinates the change across systems. The sequence includes a coordination step before the target schema changes.',
      },
      {
        label: 'Stay aligned',
        copy: 'The new field is now reflected in both illustrated schemas, preserving shared meaning as the product evolves.',
      },
    ],
    result: 'One change. A shared understanding.',
    description:
      'A new field is added to an illustrative schema on the Core Metadata Platform. Schema Evolution coordinates the change, and the matching schema in Marketing Cloud Next gains the same field, so both schemas stay aligned. The sequence is simplified.',
  },
  {
    id: 'migration',
    project: 'migration',
    short: 'Metadata migration',
    title: 'A new foundation. Room to grow.',
    phases: [
      {
        label: 'Prepare',
        copy: 'Start with familiar object and field definitions. This story follows metadata: the structure that describes data.',
      },
      {
        label: 'Migrate',
        copy: 'Metadata definitions move onto the next-generation Core Metadata Platform while retaining their familiar shape.',
      },
      {
        label: 'Build at scale',
        copy: 'A larger structured foundation gives Data 360 room to grow, with familiar object and field semantics.',
      },
    ],
    result: 'Shared structure. More room to build.',
    description:
      'In an illustrative metadata migration, object, field, and relationship definitions move onto the next-generation Core Metadata Platform, where a larger grid of the same shapes gives Data 360 room to grow.',
  },
];
