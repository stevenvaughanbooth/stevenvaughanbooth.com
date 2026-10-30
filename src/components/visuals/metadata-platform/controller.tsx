import { useState } from 'react';
import { SegmentedTabs } from '../shared/segmented-tabs';
import { StepControls } from '../shared/step-controls';
import { useAutoAdvance } from '../shared/use-auto-advance';
import { tablistLabel, tourControls } from './controls';
import { PhaseSteps } from './phase-steps';
import { type MetadataPlatformContent, MetadataPlatformView, phasesPerStory } from './view';

/** How long each phase stays on screen while auto-advancing. */
const dwellMs = 6000;

/**
 * Loaded lazily by the shell: live tabs and phases, and a one-pass tour through every phase of
 * every story.
 */
export function MetadataPlatformController(content: MetadataPlatformContent) {
  const tour = useAutoAdvance({
    steps: content.stories.length * phasesPerStory,
    durationMs: dwellMs,
  });
  const [announcement, setAnnouncement] = useState('');
  // Play restarts the current phase's timer, so it restarts the phase's progress bar too.
  const [plays, setPlays] = useState(0);
  const story = Math.floor(tour.step / phasesPerStory);
  const phase = tour.step % phasesPerStory;
  const { status, action } = tourControls(
    tour.playback,
    tour.running,
    story,
    content.stories.length,
  );

  // A picked story opens on its last phase, its outcome. Focus on the tab already announces it.
  function selectStory(index: number) {
    tour.select(index * phasesPerStory + phasesPerStory - 1);
    setAnnouncement('');
  }

  function selectPhase(index: number) {
    const target = story * phasesPerStory + index;
    tour.select(target);
    setAnnouncement(content.announcements[target] ?? '');
  }

  function toggle() {
    tour.toggle();
    setPlays(plays + 1);
    setAnnouncement('');
  }

  return (
    <MetadataPlatformView
      {...content}
      step={tour.step}
      announcement={announcement}
      region={tour.region}
      controls={
        <StepControls
          status={status}
          accent="lilac"
          live={tour.running}
          action={{ ...action, onClick: toggle }}
        />
      }
      tabs={
        <SegmentedTabs
          id={content.id}
          label={tablistLabel}
          items={content.stories}
          selected={story}
          accent="lilac"
          onSelect={selectStory}
        />
      }
      phaseSteps={
        <PhaseSteps
          labels={content.phases}
          story={story}
          phase={phase}
          onSelect={selectPhase}
          progress={
            tour.playback === 'playing'
              ? { key: `${tour.step}-${plays}`, durationMs: dwellMs, running: tour.running }
              : null
          }
        />
      }
    />
  );
}
