import { adage } from '@/content/profile';
import { laterSessions } from './pipeline';
import { knownCommand, steps } from './script';
import { reflexParts } from './timeline';

/** What the 3D scene draws: plain strings from profile.ts and the script, built on the server. */
export interface ReflexSceneData {
  /** Adage's pipeline, one caption a stage. */
  stages: readonly string[];
  /** The loop back into later sessions, as the pipeline names it. */
  loop: string;
  /** The reflex's parts, as the terminal names them. */
  parts: readonly string[];
  /** The command the history shows works. */
  command: string;
  /** Whether each of the live session's runs passes, in order. */
  runs: readonly boolean[];
}

export function reflexSceneData(): ReflexSceneData {
  return {
    stages: adage.pipeline,
    loop: laterSessions,
    parts: reflexParts,
    command: knownCommand,
    runs: steps.flatMap((step) => (step.kind === 'run' ? [step.result === 'pass'] : [])),
  };
}
