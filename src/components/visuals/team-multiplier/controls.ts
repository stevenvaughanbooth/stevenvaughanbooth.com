import { guidedTour } from '../shared/tour/wording';

/*
 * What the tabs and footer say, shared by the server's static render and the controller (and
 * kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Stages of the multiplier loop';

/** The tour's footer: at rest the card shows the complete loop. */
export const wording = guidedTour('Full loop');
