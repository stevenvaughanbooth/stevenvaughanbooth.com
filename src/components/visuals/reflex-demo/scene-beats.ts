import { beatCount, beatsShown, type Frame, type Step } from './timeline';

/*
 * The 3D scene's beats: the moments of the replay the scene shows, in order. Pure and
 * client-safe: the controller turns a replay frame into a beat, and the scene draws each beat.
 */

/** What the scene shows at one beat. */
export interface SceneBeat {
  /** The pipeline stage being shown, 0 to 3, or 4 once the session loops into later ones. */
  stage: number;
  /** Runs in the live session whose result is in. */
  runs: number;
  /** Whether the reflex has been offered to the live session. */
  offered: boolean;
}

export const sceneBeats: readonly SceneBeat[] = [
  // The agent starts: the history of earlier sessions.
  { stage: 0, runs: 0, offered: false },
  // It types a test command: the step the history repeats lights up across it.
  { stage: 1, runs: 0, offered: false },
  // The command fails.
  { stage: 1, runs: 1, offered: false },
  // It tries again: the recurring step lifts out into a reflex, its evidence attached.
  { stage: 2, runs: 1, offered: false },
  // It fails again: the reflex's condition holds.
  { stage: 3, runs: 2, offered: false },
  // The reflex is offered to the session.
  { stage: 3, runs: 2, offered: true },
  // The agent runs the command it offered, and it passes.
  { stage: 3, runs: 3, offered: true },
  // The session is over and joins the history later sessions learn from.
  { stage: 4, runs: 3, offered: true },
];

/**
 * The scene's beat at a frame of the replay: how many of its milestones the frame has reached.
 * The script's first two runs fail, the reflex follows, and its last run passes (script.ts).
 */
export function sceneBeat(steps: readonly Step[], frame: Frame): number {
  const runs = steps.flatMap((step, index) => (step.kind === 'run' ? [index] : []));
  const reflex = steps.findIndex((step) => step.kind === 'reflex');
  const begun = (index: number | undefined) =>
    index !== undefined && index >= 0 && beatsShown(frame, index) >= 1;
  const done = (index: number | undefined) => {
    const step = index === undefined ? undefined : steps[index];
    return step !== undefined && beatsShown(frame, index!) >= beatCount(step);
  };
  const milestones = [
    begun(runs[0]),
    done(runs[0]),
    begun(runs[1]),
    done(runs[1]),
    begun(reflex),
    done(runs.at(-1)),
    frame.step >= steps.length,
  ];
  return milestones.filter(Boolean).length;
}
