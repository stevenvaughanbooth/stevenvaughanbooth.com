import { useState } from 'react';
import { SegmentedTabs } from '../shared/segmented-tabs';
import { SceneCanvas } from '../shared/three/scene-canvas';
import { TourControls } from '../shared/tour/tour-controls';
import { useTour } from '../shared/tour/use-tour';
import { tablistLabel, wording } from './controls';
import { PhaseSteps } from './phase-steps';
import { type MetadataPlatformContent, MetadataPlatformView, phasesPerStory } from './view';

/** The 3D scene's chunk, with three.js. SceneCanvas imports it once the page has settled. */
const loadScene = () => import('./scene');

/**
 * Loaded lazily by the shell: live tabs and phases, the shared one-pass tour through every phase
 * of every story, and the 3D platform scene over the diagrams where the device can draw it.
 */
export function MetadataPlatformController(content: MetadataPlatformContent) {
  // The tour waits for the 3D scene to swap in (or not), so it never swaps in mid-step.
  const [settled, setSettled] = useState(false);
  const tour = useTour({ steps: content.stories.length * phasesPerStory, hold: !settled });
  const [announcement, setAnnouncement] = useState('');
  const story = Math.floor(tour.step / phasesPerStory);
  const phase = tour.step % phasesPerStory;

  // A picked story opens at its beginning, as the tour does. Focus on the tab already announces it.
  function selectStory(index: number) {
    tour.select(index * phasesPerStory);
    setAnnouncement('');
  }

  function selectPhase(index: number) {
    const target = story * phasesPerStory + index;
    tour.select(target);
    setAnnouncement(content.announcements[target] ?? '');
  }

  function toggle() {
    tour.toggle();
    setAnnouncement('');
  }

  return (
    <MetadataPlatformView
      {...content}
      step={tour.step}
      announcement={announcement}
      region={tour.region}
      controls={
        <TourControls
          accent="lilac"
          playback={tour.playback}
          running={tour.running}
          looking={tour.looking}
          wording={wording(story, content.stories.length)}
          onToggle={toggle}
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
          progress={tour.progress}
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
