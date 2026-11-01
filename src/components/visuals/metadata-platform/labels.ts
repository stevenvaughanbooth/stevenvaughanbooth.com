/*
 * The words inside each story's diagram, shared by the server-rendered SVG (scenes.tsx) and the
 * 3D scene (scene-data.ts), so the two drawings always say the same thing.
 */

export const platformName = 'Core Metadata Platform';

/** One illustrative piece of metadata: its badge letter, its type, and an example. */
export interface MetadataItem {
  letter: string;
  label: string;
  value: string;
}

export const agentsLabels = {
  source: 'Salesforce Core',
  hub: platformName,
  tools: 'MCP tools',
  steps: ['Discover', 'Understand', 'Use'],
  target: 'Agent context',
  pending: 'Ready for product context',
  outcome: 'Usable context',
  metadata: [
    { letter: 'O', label: 'Object', value: 'Account' },
    { letter: 'F', label: 'Field', value: 'Industry' },
    { letter: 'R', label: 'Relationship', value: 'Owner' },
  ] as readonly MetadataItem[],
} as const;

/** A schema row: its name and type. */
export interface SchemaRow {
  label: string;
  value: string;
}

export const schemaLabels = {
  source: platformName,
  rows: [
    { label: 'Record ID', value: 'id' },
    { label: 'Name', value: 'text' },
  ] as readonly SchemaRow[],
  added: { label: 'New field', value: 'text' } as SchemaRow,
  hub: 'Schema Evolution',
  hubBody: 'Coordinates changes',
  target: 'Marketing Cloud Next',
  pending: 'Awaiting coordinated change',
  outcome: 'Schema aligned',
} as const;

export const migrationLabels = {
  source: 'Metadata definitions',
  definitions: [
    { letter: 'O', label: 'Object' },
    { letter: 'F', label: 'Fields' },
    { letter: 'R', label: 'Relationships' },
  ] as readonly { letter: string; label: string }[],
  hub: 'Metadata migration',
  target: platformName,
  foundation: 'Next-generation foundation',
} as const;
