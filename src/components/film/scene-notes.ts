import 'server-only';
import type { Scene } from './media';

/**
 * What each chapter shows: the film's text alternative, read in the 'Scene by scene' dialog.
 * Server-only, so the descriptions are in the page's HTML and never in a client chunk. Keyed by
 * title, so a chapter cannot be added to media.ts without a description.
 */
export const sceneNotes: Record<Scene['title'], string> = {
  'San Francisco / Arrival':
    'Golden-hour light over the Golden Gate Bridge, with the city skyline across the water.',
  'Toward the workspace':
    'Downtown, the camera rises toward a tall glass tower and pushes in until its windows fill the frame.',
  'Behind the ideas':
    'Through the glass, an office: someone at a desk, seen from behind, with the bay and a bridge glowing beyond the windows.',
  'A builder’s workspace':
    'The camera moves past them to the monitor until its dark screen fills the frame.',
};
