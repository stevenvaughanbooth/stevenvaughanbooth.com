import { parts } from './stages';

/** What the 3D scene draws: the diagram's own names, built on the server and passed once. */
export type MultiplierSceneData = Readonly<Record<keyof typeof parts, string>>;

export function multiplierSceneData(): MultiplierSceneData {
  return { ...parts };
}
