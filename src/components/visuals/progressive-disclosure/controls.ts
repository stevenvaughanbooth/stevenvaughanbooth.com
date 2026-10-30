import type { StepAction } from '../shared/step-controls';

/*
 * What the tabs and footer say, shared by the server's static render and the controller (and
 * kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Steps of progressive disclosure';

/** The footer's status text and Next / Start again control for a step. */
export function stepControls(steps: readonly string[], step: number) {
  const next = steps[step + 1];
  const action: StepAction = next
    ? { label: `Next: ${next}`, icon: 'next' }
    : { label: 'Start again', icon: 'replay' };
  return { status: `Step ${step + 1} of ${steps.length}`, action };
}
