import { SegmentedTabs } from '../shared/segmented-tabs';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { tablistLabel, wording } from './controls';
import { type TeamMultiplierContent, TeamMultiplierView } from './view';

/** Loaded lazily by the shell: live tabs plus the shared one-pass tour through the stages. */
export function TeamMultiplierController(content: TeamMultiplierContent) {
  const tour = useTour({ steps: content.stages.length });

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
          progress={tour.progress}
        />
      }
      footer={
        <TourControls
          accent="amber"
          playback={tour.playback}
          running={tour.running}
          wording={wording}
          onToggle={tour.toggle}
        />
      }
    />
  );
}
