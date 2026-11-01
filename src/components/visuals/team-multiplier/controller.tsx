import { useState } from 'react';
import { SegmentedTabs } from '../shared/segmented-tabs';
import { SceneCanvas } from '../shared/three/scene-canvas';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { tablistLabel, wording } from './controls';
import { type TeamMultiplierContent, TeamMultiplierView } from './view';

/** The 3D scene's chunk, with three.js. SceneCanvas imports it once the page has settled. */
const loadScene = () => import('./scene');

/**
 * Loaded lazily by the shell: live tabs, the shared one-pass tour through the stages, and the
 * network in 3D over the SVG where the device can draw it.
 */
export function TeamMultiplierController(content: TeamMultiplierContent) {
  // The tour waits for the 3D scene to swap in (or not), so it never swaps in mid-step.
  const [settled, setSettled] = useState(false);
  const tour = useTour({ steps: content.stages.length, hold: !settled });

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
          looking={tour.looking}
          wording={wording}
          onToggle={tour.toggle}
        />
      }
      scene={
        <SceneCanvas
          load={loadScene}
          data={content.sceneData}
          step={tour.step}
          running={tour.running}
          onSettle={() => setSettled(true)}
        />
      }
    />
  );
}
