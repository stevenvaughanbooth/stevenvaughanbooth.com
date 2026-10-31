import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { isPageTargetId, type PageTargetId, pageTargetIds, pageTargets } from '@/lib/page-targets';

/**
 * The one tool Claude may call: point the visitor at a place on the site. It runs nowhere on the
 * server and its result is never sent back, so a call costs no second request. The call ends the
 * turn, which is why the prompt asks for the full answer first.
 */
export const SHOW_TOOL = 'show_on_page';

/** `{"target":"case-study-platform"}` is a few dozen bytes; anything far longer is not an answer. */
const INPUT_MAX = 256;

export const showOnPageTool: Anthropic.Tool = {
  name: SHOW_TOOL,
  description: [
    'Shows the visitor the place on this site that covers what they asked about. The site displays it as a button under your answer, and moves the page there only when the visitor asked to be shown something.',
    'Call it at most once, only after you have written your whole answer, and only when one target clearly fits. If none does, do not call it.',
    'Targets:',
    ...pageTargets.map((target) => `- ${target.id}: ${target.about}`),
  ].join('\n'),
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', enum: pageTargetIds, description: 'One target id from the list.' },
    },
    required: ['target'],
    additionalProperties: false,
  },
  strict: true,
  // Fragments stream as they are generated, so the server no longer vouches for the JSON; the
  // input is parsed strictly and checked against the allowlist below either way.
  eager_input_streaming: true,
};

const showInput = z.object({ target: z.enum(pageTargetIds) }).strict();

/** The target a tool input names, or null for anything but exactly one allowlisted target. */
export function parseShowInput(json: string): PageTargetId | null {
  if (json.length > INPUT_MAX) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = showInput.safeParse(value);
  return parsed.success && isPageTargetId(parsed.data.target) ? parsed.data.target : null;
}
