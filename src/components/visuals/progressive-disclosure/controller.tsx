import { SegmentedTabs } from '../shared/segmented-tabs';
import { SceneCanvas } from '../shared/three/scene-canvas';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { tablistLabel, wording } from './controls';
import { type ProgressiveDisclosureContent, ProgressiveDisclosureView } from './view';

/** The 3D scene's chunk, with three.js. SceneCanvas imports it once the page has settled. */
const loadScene = () => import('./scene');

/**
 * Loaded lazily by the shell: live tabs, the shared one-pass tour through describe, search and
 * query, and the layered 3D scene over the graph where the device can draw it.
 */
export function ProgressiveDisclosureController(content: ProgressiveDisclosureContent) {
  const tour = useTour({ steps: content.steps.length });

  return (
    <ProgressiveDisclosureView
      {...content}
      step={tour.step}
      region={tour.region}
      tabs={
        <SegmentedTabs
          id={content.id}
          label={tablistLabel}
          items={content.steps}
          selected={tour.step}
          accent="green"
          onSelect={tour.select}
          progress={tour.progress}
        />
      }
      footer={
        <TourControls
          accent="green"
          playback={tour.playback}
          running={tour.running}
          wording={wording(tour.step, content.steps.length)}
          onToggle={tour.toggle}
        />
      }
      scene={<SceneCanvas load={loadScene} data={content.sceneData} step={tour.step} />}
    />
  );
}
