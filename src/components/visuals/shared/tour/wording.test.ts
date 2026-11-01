import { describe, expect, it } from 'vitest';
import { guidedTour, tourStatus } from './wording';

describe('tourStatus', () => {
  const wording = guidedTour('Full loop');

  it('offers Pause while playing, and says it is held only while the visitor looks', () => {
    expect(tourStatus('playing', false, wording)).toEqual({
      status: 'Auto-advancing',
      action: { label: 'Pause', icon: 'pause', name: 'Pause auto-advance' },
    });
    expect(tourStatus('playing', true, wording).status).toBe('Paused while you look');
  });

  it('offers Play before it starts, when paused or ready, and Replay at the end', () => {
    expect(tourStatus('idle', false, wording)).toMatchObject({
      status: 'Full loop',
      action: { label: 'Play', name: 'Play auto-advance' },
    });
    expect(tourStatus('paused', false, wording).action.label).toBe('Play');
    expect(tourStatus('ready', false, wording)).toMatchObject({ status: 'Ready' });
    expect(tourStatus('done', false, wording)).toMatchObject({
      status: 'Full loop',
      action: { label: 'Replay', icon: 'replay', name: 'Replay auto-advance' },
    });
  });

  it('starts every accessible name with the visible label', () => {
    for (const playback of ['idle', 'ready', 'playing', 'paused', 'done'] as const) {
      const { action } = tourStatus(playback, true, { ...wording, object: 'the session' });
      expect(action.name?.startsWith(action.label)).toBe(true);
    }
  });
});
