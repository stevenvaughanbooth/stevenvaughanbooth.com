import { SegmentedTabs } from '../shared/segmented-tabs';
import { StepControls } from '../shared/step-controls';
import { useAutoAdvance } from '../shared/use-auto-advance';
import { tablistLabel, tourControls } from './controls';
import { type TeamMultiplierContent, TeamMultiplierView } from './view';

/** How long each stage stays on screen while auto-advancing. */
const dwellMs = 5000;

/** Loaded lazily by the shell: live tabs plus a one-pass auto-advance through the stages. */
export function TeamMultiplierController(content: TeamMultiplierContent) {
  const tour = useAutoAdvance({ steps: content.stages.length, durationMs: dwellMs });
  const { status, action } = tourControls(tour.playback, tour.running);

  return (
    <TeamMultiplierView
      {...content}
      step={tour.step}
      region={tour.region}
      tabs={
        <SegmentedTabs
          id={content.id}
          label={tablistLabel}
          items={content.stages}
          selected={tour.step}
          accent="amber"
          onSelect={tour.select}
          progress={
            tour.playback === 'playing' ? { durationMs: dwellMs, running: tour.running } : null
          }
        />
      }
      footer={
        <StepControls
          status={status}
          accent="amber"
          live={tour.running}
          action={{ ...action, onClick: tour.toggle }}
        />
      }
    />
  );
}
