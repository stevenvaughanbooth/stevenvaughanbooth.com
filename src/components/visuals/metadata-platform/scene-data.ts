import { agentsLabels, migrationLabels, platformName, schemaLabels } from './labels';
import { stories } from './stories';

/**
 * What the 3D scene draws: the words of each story's diagram (labels.ts) and its result, plain
 * strings built on the server and passed once.
 */
export interface PlatformSceneData {
  platform: string;
  agents: {
    source: string;
    tools: string;
    steps: readonly string[];
    target: string;
    outcome: string;
    metadata: readonly { letter: string; value: string }[];
  };
  schema: {
    rows: readonly { label: string; value: string }[];
    added: { label: string; value: string };
    hub: string;
    hubBody: string;
    target: string;
    outcome: string;
  };
  migration: {
    source: string;
    definitions: readonly { letter: string; label: string }[];
    hub: string;
    foundation: string;
  };
  /** Each story's result, shown once it reaches its last phase. */
  results: readonly string[];
}

export function platformSceneData(): PlatformSceneData {
  return {
    platform: platformName,
    agents: {
      source: agentsLabels.source,
      tools: agentsLabels.tools,
      steps: agentsLabels.steps,
      target: agentsLabels.target,
      outcome: agentsLabels.outcome,
      metadata: agentsLabels.metadata.map(({ letter, value }) => ({ letter, value })),
    },
    schema: {
      rows: schemaLabels.rows,
      added: schemaLabels.added,
      hub: schemaLabels.hub,
      hubBody: schemaLabels.hubBody,
      target: schemaLabels.target,
      outcome: schemaLabels.outcome,
    },
    migration: {
      source: migrationLabels.source,
      definitions: migrationLabels.definitions,
      hub: migrationLabels.hub,
      foundation: migrationLabels.foundation,
    },
    results: stories.map((story) => story.result),
  };
}
