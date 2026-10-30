import { getImageProps } from 'next/image';
import salesforceLogo from '@/assets/salesforce-logo.png';
import { careerStartYear, experience } from '@/content/profile';
import s from './career-timeline/career-timeline.module.css';
import { Axis, Roles } from './career-timeline/chart';
import { buildTimeline } from './career-timeline/timeline';

/**
 * Five roles as a rising step chart on a 2018 → now axis. Everything renders on the server: the
 * roles are native disclosures and the logo is a plain optimized <img>, so the card ships no
 * client JavaScript.
 */
export function CareerTimeline() {
  const { steps, years } = buildTimeline(experience, careerStartYear);
  const { props: logo } = getImageProps({ src: salesforceLogo, alt: 'Salesforce', width: 48 });

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- getImageProps supplies the optimized srcset */}
          <img {...logo} alt={logo.alt} className="h-auto shrink-0" />
          <p className="font-medium">Engineering</p>
        </div>
        <p className="label">
          {steps[0]?.start} → {steps.at(-1)?.end}
        </p>
      </div>

      <div className={`${s.chart} mt-7 md:mt-10`}>
        <Axis years={years} />
        <Roles steps={steps} />
        <p className={`${s.hint} text-sm text-muted`}>Select a role to see its details.</p>
      </div>
    </div>
  );
}
