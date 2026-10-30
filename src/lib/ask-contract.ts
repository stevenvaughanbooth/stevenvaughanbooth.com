/**
 * The /api/ask contract (docs/architecture.md), shared by the route, its server-side schema and
 * the browser client so the two sides cannot drift apart. Limits and types only: nothing here is
 * secret, so the browser may import it.
 */

export const ASK_ENDPOINT = '/api/ask';

/** Longest question, in characters after trimming. */
export const QUESTION_MAX = 400;
/** How many of the visitor's earlier questions may come along as context. */
export const HISTORY_MAX_ITEMS = 3;
/** Live questions per visitor in any 24 hours. */
export const VISITOR_LIMIT = 3;

/** Headers on a 200 answer: the visitor's questions left, and the allowance. */
export const REMAINING_HEADER = 'X-Ask-Remaining';
export const LIMIT_HEADER = 'X-Ask-Limit';

/** GET /api/ask */
export interface AskStatus {
  enabled: boolean;
  limit: number;
  /** For display only. POST decides, and every answer reports the new count. */
  remaining: number;
}

/** POST /api/ask */
export interface AskRequest {
  question: string;
  /**
   * The visitor's earlier questions, oldest first, so a follow-up such as "and its license?"
   * makes sense. Earlier answers are never sent back: the server would have to trust them.
   */
  history?: string[];
}

/** The `error` of every non-200 JSON body, with the status the route sends it with. */
export const ASK_ERRORS = {
  invalid_request: 400,
  forbidden: 403,
  /** The visitor (or their network) has used today's questions. Body also has `remaining: 0`. */
  limit_reached: 429,
  /** Too many questions site-wide this minute. Sent with Retry-After. */
  busy: 429,
  /** Live answers are off: not configured, switched off, or the day's budget is spent. */
  unavailable: 503,
  /** Claude could not answer. The visitor's question is not counted. */
  upstream: 502,
} as const;

export type AskErrorCode = keyof typeof ASK_ERRORS;

export function isAskErrorCode(value: unknown): value is AskErrorCode {
  return typeof value === 'string' && Object.hasOwn(ASK_ERRORS, value);
}
