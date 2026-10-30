import { useState } from 'react';
import { SegmentedTabs } from '../shared/segmented-tabs';
import { StepControls } from '../shared/step-controls';
import { stepControls, tablistLabel } from './controls';
import { type ProgressiveDisclosureContent, ProgressiveDisclosureView } from './view';

/** Loaded lazily by the shell: live tabs and the Next / Start again button. */
export function ProgressiveDisclosureController(content: ProgressiveDisclosureContent) {
  const [step, setStep] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const { status, action } = stepControls(content.steps, step);

  // Focus on a tab already announces it, so picking a tab stays quiet.
  function select(index: number) {
    setStep(index);
    setAnnouncement('');
  }

  function next() {
    const target = step === content.steps.length - 1 ? 0 : step + 1;
    setStep(target);
    setAnnouncement(content.announcements[target] ?? '');
  }

  return (
    <ProgressiveDisclosureView
      {...content}
      step={step}
      announcement={announcement}
      tabs={
        <SegmentedTabs
          id={content.id}
          label={tablistLabel}
          items={content.steps}
          selected={step}
          accent="green"
          onSelect={select}
        />
      }
      footer={<StepControls status={status} accent="green" action={{ ...action, onClick: next }} />}
    />
  );
}
