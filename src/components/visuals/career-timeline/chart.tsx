import type { CSSProperties } from 'react';
import { roleAnchor } from '@/lib/page-targets';
import { formatIndex } from '../shared/segmented-tabs';
import s from './career-timeline.module.css';
import type { Step, YearTick } from './timeline';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** The scope and time axes the roles stand on. Decorative: every role carries its own dates. */
export function Axis({ years }: { years: readonly YearTick[] }) {
  return (
    <div aria-hidden className={s.axis}>
      <span className={`label ${s.scope}`}>Scope ↑</span>
      <span className={s.baseline} />
      {years.map((tick) => {
        const style: Vars = { '--x': tick.x };
        return (
          <span key={tick.year} className={s.tick} style={style}>
            <span>{tick.year}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * The roles as an ordered list of disclosures, rendered on the server with no client code. On
 * phones it is a vertical ladder; from md up the same items are placed on the step chart drawn
 * around them. Each role is a <details> sharing one name, so opening one closes the others, and
 * its <summary> reports expanded or collapsed: the state matches what everyone is shown. The
 * current role starts open.
 */
export function Roles({ steps }: { steps: readonly Step[] }) {
  const count = formatIndex(steps.length - 1);

  return (
    <ol className={s.list} aria-label="Roles at Salesforce, earliest first">
      {steps.map((step, index) => {
        const style: Vars = { '--x': step.x, '--w': step.width, '--level': step.level };
        return (
          <li
            key={step.key}
            // A stable anchor, so Ask Steven can show (and open) this role.
            id={roleAnchor(step)}
            className={s.role}
            style={style}
            data-current={step.current || undefined}
          >
            <span aria-hidden className={s.area} />
            {step.current ? <span aria-hidden className={s.now} /> : null}
            <details name="career-role" open={step.current}>
              <summary className={s.step}>
                <span aria-hidden className={s.line} />
                <span aria-hidden className={s.node} />
                <span className={s.title}>{step.displayTitle}</span>
                <span className={s.dates}>
                  {step.start}
                  <span aria-hidden> – </span>
                  <span className="sr-only"> to </span>
                  {step.end}
                </span>
                <span aria-hidden className={s.meter}>
                  {steps.map((_, bar) => (
                    <span key={bar} data-on={bar < step.level || undefined} />
                  ))}
                </span>
              </summary>
              <div className={s.detail}>
                <div className={s.overview} aria-hidden>
                  <p className="label">
                    Role {formatIndex(index)} of {count}
                    {step.current ? <span className="text-green"> · Now</span> : null}
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight">{step.displayTitle}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {step.start} – {step.end}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    {step.title === step.displayTitle ? null : (
                      <>
                        {step.title}
                        <span aria-hidden> · </span>
                        <span className="sr-only">. </span>
                      </>
                    )}
                    {step.tenure}
                  </p>
                  {step.focus ? (
                    <p className="mt-2 leading-relaxed text-pretty">
                      <span className="sr-only">Focus: </span>
                      {step.focus}
                    </p>
                  ) : null}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
