import type { TourWording } from '../shared/tour/wording';

/*
 * What the footer says, shared by the server's static render and the controller (and kept out
 * of view.tsx, which ships in the initial page). The states and the control are every tour's.
 */
export const wording: TourWording = {
  running: 'Replaying',
  rest: 'Full session',
  object: 'the session',
};
