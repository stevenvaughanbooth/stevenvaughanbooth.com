import { agentLabel, steps } from './steps';

/** What the 3D scene draws: plain strings from steps.ts, built on the server and passed once. */
export interface DisclosureSceneData {
  agent: string;
  /** One layer per step, from the map down to the record. */
  layers: readonly { call: string; returns: string; rows: readonly string[] }[];
}

export function disclosureSceneData(): DisclosureSceneData {
  return {
    agent: agentLabel,
    layers: steps.map((step) => ({
      call: `${step.call.tool}(${step.call.args})`,
      returns: step.returns,
      rows: step.rows,
    })),
  };
}
