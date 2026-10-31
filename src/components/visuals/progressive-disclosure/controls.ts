import { guidedTour } from '../shared/tour/wording';

/*
 * What the tabs and footer say, shared by the server's static render and the controller (and
 * kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Steps of progressive disclosure';

/** The tour's footer, which at rest names the step on show. */
export const wording = (step: number, count: number) => guidedTour(`Step ${step + 1} of ${count}`);
