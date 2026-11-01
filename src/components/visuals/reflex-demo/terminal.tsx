import { Fragment, type ReactNode } from 'react';
import styles from './terminal.module.css';
import { beatsShown, type Frame, reflexParts, runProgress, type Step } from './timeline';

type RunStep = Extract<Step, { kind: 'run' }>;
type ReflexStep = Extract<Step, { kind: 'reflex' }>;

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

// A part of a line that is not shown yet keeps its space, so the line never reflows.
const reveal = (shown: boolean) =>
  cx(
    'transition duration-300 ease-out',
    shown ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0',
  );

// A line that is not shown yet takes no space: the console grows as a terminal does, and scrolls.
// While the replay plays, a line fades in as it appears.
const line = (shown: boolean, enter: boolean) => (shown ? enter && styles.enter : 'hidden');

const chip = 'rounded-full border px-2 text-micro leading-[1.125rem] tracking-[0.08em] uppercase';

interface TerminalProps {
  steps: readonly Step[];
  frame: Frame;
  /** Shows the cursors: only while the replay plays on screen. */
  live?: boolean;
  /** Pulses the reflex as it appears, and fades each line in: only while the replay plays. */
  flash?: boolean;
}

/**
 * The replay's terminal lines at one frame, inside the console ReflexDemoView draws. The server
 * renders them at the final frame for the static card; the controller renders them frame by
 * frame. They are hidden from assistive technology, which reads the transcript instead.
 */
export function Terminal({ steps, frame, live = false, flash = false }: TerminalProps) {
  return (
    <div aria-hidden className="relative font-mono text-xs leading-relaxed @md:text-[0.8125rem]">
      {live && frame.step === 0 && frame.beat === 0 ? (
        <span className={cx(styles.cursor, styles.blink, 'absolute top-0 left-0')} />
      ) : null}
      {steps.map((step, i) => {
        const beats = beatsShown(frame, i);
        const key = `${step.kind}-${i}`;
        switch (step.kind) {
          case 'agent':
            return (
              <p
                key={key}
                className={cx('flex gap-2.5 text-muted', i > 0 && 'mt-3', line(beats >= 1, flash))}
              >
                <span className="text-lilac">●</span>
                <span>{step.text}</span>
              </p>
            );
          case 'run':
            return <Run key={key} step={step} beats={beats} live={live} enter={flash} />;
          case 'reflex':
            return <Reflex key={key} step={step} shown={beats >= 1} flash={flash && beats >= 1} />;
        }
      })}
    </div>
  );
}

interface RunProps {
  step: RunStep;
  beats: number;
  live: boolean;
  enter: boolean;
}

function Run({ step, beats, live, enter }: RunProps) {
  const progress = runProgress(step, beats);
  const failed = step.result === 'fail';
  const typedAll = progress.typed === step.command.length;

  return (
    <div className={cx('mt-3', !progress.prompt && 'hidden')}>
      <p className={cx('flex items-start justify-between gap-3', line(progress.prompt, enter))}>
        <span className="min-w-0">
          <span className="text-subtle select-none">$ </span>
          <span className="font-medium text-fg">{step.command.slice(0, progress.typed)}</span>
          {live && progress.typing ? (
            <span className={cx(styles.cursor, typedAll && styles.blink)} />
          ) : null}
          <span className="invisible">{step.command.slice(progress.typed)}</span>
        </span>
        <span
          className={cx(
            'mt-px shrink-0',
            chip,
            failed ? 'border-amber/40 text-amber' : 'border-green/40 text-green',
            reveal(progress.status),
          )}
        >
          {failed ? '✕ failed' : '✓ passed'}
        </span>
      </p>
      {step.output.map((output, i) => (
        <p
          key={output}
          className={cx(
            'ml-1 border-l border-line pt-0.5 pl-3.5 [overflow-wrap:anywhere] whitespace-pre-wrap',
            i === step.output.length - 1 ? (failed ? 'text-amber' : 'text-green') : 'text-subtle',
            line(i < progress.outputs, enter),
          )}
        >
          {output}
        </p>
      ))}
    </div>
  );
}

function Reflex({ step, shown, flash }: { step: ReflexStep; shown: boolean; flash: boolean }) {
  const [condition, response, evidence] = reflexParts;
  const rows: [string, ReactNode][] = [
    [condition, step.condition],
    [response, highlight(step.response, step.command)],
    [evidence, highlight(step.evidence, step.command)],
  ];

  return (
    <div
      className={cx(
        'mt-4 mb-1 rounded-xl border border-green/35 bg-green/[0.05] p-3.5 @md:p-4',
        shown ? flash && styles.matched : 'hidden',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="whitespace-nowrap">
          <span className="font-medium text-green">adage</span>
          <span className="text-muted"> · reflex matched</span>
        </p>
        <span
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 border-green/40 bg-surface font-medium text-green',
            chip,
          )}
        >
          <span className="size-1.5 rounded-full bg-green" />
          {step.strength}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-4 @md:grid-cols-[5.5rem_1fr] @md:gap-y-2">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="label text-muted @md:pt-0.5">{label}</dt>
            <dd className="mb-2.5 text-fg last:mb-0 @md:mb-0">{value}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="mt-3 border-t border-green/20 pt-2.5 text-xs leading-relaxed text-muted">
        <span className="text-green">{step.strength}</span>: {step.strengthMeaning}. Guidance only:
        the agent decides.
      </p>
    </div>
  );
}

/** Sets each occurrence of `token` in `text` as inline code. */
function highlight(text: string, token: string): ReactNode {
  return text.split(token).map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? (
        <code className="rounded border border-green/30 bg-surface px-1 font-medium whitespace-nowrap text-green">
          {token}
        </code>
      ) : null}
      {part}
    </Fragment>
  ));
}
