/**
 * The replay's data model and clock. Pure and client-safe: the script itself is built on the
 * server from profile.ts and passed to the controller, so no client chunk includes the profile.
 */

export type Step =
  | { kind: 'agent'; text: string }
  | {
      kind: 'run';
      command: string;
      output: string[];
      result: 'fail' | 'pass';
    }
  | {
      kind: 'reflex';
      strength: string;
      strengthMeaning: string;
      condition: string;
      response: string;
      evidence: string;
      command: string;
    };

/** A point in the replay: every step before `step` is complete; `step` shows `beat` beats. */
export interface Frame {
  step: number;
  beat: number;
  /** Milliseconds to wait before showing this frame. */
  delay: number;
}

const typingDelay = (i: number) => 38 + ((i * 29) % 34);

function beatDelays(step: Step, previous: Step | undefined): number[] {
  switch (step.kind) {
    case 'agent':
      // Give the reflex time to be read before the agent acts on it.
      return [previous === undefined ? 450 : previous.kind === 'reflex' ? 2600 : 700];
    case 'reflex':
      return [900];
    case 'run':
      return [
        // A retry waits a moment, so the failure before it can be read.
        previous?.kind === 'run' ? 900 : 420,
        ...Array.from(step.command, (_, i) => typingDelay(i)),
        ...step.output.map((_, i) => (i === 0 ? 560 : 130)),
        280,
      ];
  }
}

/** Beats in a step: a run shows its prompt, each typed character, each output line, then a status. */
export function beatCount(step: Step): number {
  return step.kind === 'run' ? step.command.length + step.output.length + 2 : 1;
}

export function buildFrames(steps: readonly Step[]): Frame[] {
  const frames: Frame[] = [{ step: 0, beat: 0, delay: 0 }];
  steps.forEach((step, i) => {
    beatDelays(step, steps[i - 1]).forEach((delay, b) =>
      frames.push({ step: i, beat: b + 1, delay }),
    );
  });
  // The closing frame: the session is over and its history feeds later learning.
  frames.push({ ...finalFrame(steps), delay: 700 });
  return frames;
}

/** The finished session: every step complete. The server renders it, and it is where a replay rests. */
export function finalFrame(steps: readonly Step[]): Frame {
  return { step: steps.length, beat: 0, delay: 0 };
}

/** Beats of step `index` visible at `frame`: 0 when hidden, Infinity when complete. */
export function beatsShown(frame: Frame, index: number): number {
  if (index < frame.step) return Infinity;
  if (index > frame.step) return 0;
  return frame.beat;
}

/** How much of a run step is visible after `beats` beats. */
export function runProgress(step: Extract<Step, { kind: 'run' }>, beats: number) {
  const typed = Math.min(Math.max(beats - 1, 0), step.command.length);
  const outputs = Math.min(Math.max(beats - 1 - step.command.length, 0), step.output.length);
  return {
    prompt: beats >= 1,
    typed,
    typing: beats >= 1 && outputs === 0 && beats !== Infinity,
    outputs,
    status: beats >= beatCount(step),
  };
}
