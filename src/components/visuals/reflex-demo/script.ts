import { adage } from '@/content/profile';
import type { Step } from './timeline';

/** The command the README's worked example says the history shows works. */
export const knownCommand = 'make test';

const missingModule = "E   ModuleNotFoundError: No module named 'app'";

/**
 * An illustrative replay of the README's worked example. The reflex is quoted from profile.ts;
 * the session around it (the failing commands, their output, the test count) is made up to show
 * the shape of the interaction, and the card labels it as such. The agent tries a test command
 * that bypasses the setup twice before the reflex matches, as its condition requires.
 */
export const steps: Step[] = [
  { kind: 'agent', text: 'Running the tests to check the change.' },
  {
    kind: 'run',
    command: 'pytest',
    output: ["ImportError while loading conftest 'tests/conftest.py'.", missingModule],
    result: 'fail',
  },
  { kind: 'run', command: 'python -m pytest', output: [missingModule], result: 'fail' },
  {
    kind: 'reflex',
    // The README: "yellow Prime or green Fire, which describe advice strength".
    strength: 'Fire',
    strengthMeaning: 'recommended on qualifying evidence',
    ...adage.example,
    command: knownCommand,
  },
  { kind: 'agent', text: 'Using the repository’s wrapper instead of retrying.' },
  { kind: 'run', command: knownCommand, output: ['20 passed in 1.84s'], result: 'pass' },
];

/** The same story as plain sentences, for screen readers. */
export function transcript(script: readonly Step[]): string[] {
  return script.map((step) => {
    switch (step.kind) {
      case 'agent':
        return `The agent says: ${step.text}`;
      case 'run': {
        // Drop pytest's "E" gutter, which a screen reader would read out as a letter.
        const output = step.output.map((line) => line.replace(/^E\s+/, '')).join(' ');
        return `The agent runs ${step.command}. It ${step.result === 'pass' ? 'passes' : 'fails'}: ${output}`;
      }
      case 'reflex':
        return `Adage matches a reflex. Advice strength: ${step.strength}, ${step.strengthMeaning}. Condition: ${step.condition} Response: ${step.response} Evidence: ${step.evidence} This is guidance only: the agent decides whether to run the command.`;
    }
  });
}
