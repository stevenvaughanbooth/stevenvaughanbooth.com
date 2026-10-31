import { guidedTour } from '../shared/tour/wording';

/*
 * What the tabs and the play control say, shared by the server's static render and the
 * controller (and kept out of view.tsx, which ships in the initial page).
 */

export const tablistLabel = 'Platform stories';

/** The tour's footer, which at rest names the story on show. */
export const wording = (story: number, count: number) =>
  guidedTour(`Story ${story + 1} of ${count}`);
