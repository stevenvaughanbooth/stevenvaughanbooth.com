/**
 * Browser client for the /api/ask contract (src/lib/ask-contract.ts). It never sees the API key:
 * it talks only to this site's own route, which holds the key server-side.
 */
import {
  ASK_ENDPOINT,
  type AskRequest,
  type AskStatus,
  HISTORY_MAX_ITEMS,
  isAskErrorCode,
  LIMIT_HEADER,
  QUESTION_MAX,
  REMAINING_HEADER,
} from '@/lib/ask-contract';

const STATUS_TIMEOUT_MS = 6000;
const RESPONSE_TIMEOUT_MS = 30000;

export type AskOutcome =
  | {
      kind: 'stream';
      chunks: AsyncGenerator<string>;
      remaining: number | null;
      limit: number | null;
    }
  | { kind: 'limit_reached' }
  | { kind: 'busy'; retryAfter: number | null }
  /** 503, missing route, or network failure: live answers are off. */
  | { kind: 'unavailable' }
  /** 400, 403, 502 and other errors: answer this one from curated notes. */
  | { kind: 'fallback'; reason: 'invalid_request' | 'forbidden' | 'upstream' | 'unknown' };

function count(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Fetches the visitor's allowance. Returns null when live answers cannot be reached. */
export async function getAskStatus(signal?: AbortSignal): Promise<AskStatus | null> {
  try {
    const response = await fetch(ASK_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: signal ?? AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return null;
    const { enabled, limit, remaining } = body as Record<string, unknown>;
    const max = count(limit);
    const left = count(remaining);
    if (typeof enabled !== 'boolean' || max === null || left === null) return null;
    return { enabled, limit: max, remaining: Math.min(left, max) };
  } catch {
    return null;
  }
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);

/** Clamps the question and the visitor's earlier questions to the contract's limits. */
export function buildRequest(question: string, earlier: readonly string[] = []): AskRequest {
  const history = earlier.map(tidy).filter(Boolean).slice(-HISTORY_MAX_ITEMS);
  const body: AskRequest = { question: tidy(question) };
  if (history.length > 0) body.history = history;
  return body;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = count(value);
  if (seconds !== null) return seconds;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000));
}

/** Decodes a byte stream into text chunks as they arrive. */
export async function* readText(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
    const rest = decoder.decode();
    if (rest) yield rest;
  } finally {
    reader.releaseLock();
  }
}

async function errorCode(response: Response) {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body && isAskErrorCode(body.error)) {
      return body.error;
    }
  } catch {
    // Not JSON; the status code decides.
  }
  return null;
}

/**
 * Sends a question to Claude through /api/ask and maps every contract error to an outcome. The
 * history is the visitor's own earlier questions; answers are never sent back. Throws only when
 * the caller aborts.
 */
export async function askClaude(
  question: string,
  earlier: readonly string[] = [],
  signal?: AbortSignal,
): Promise<AskOutcome> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ASK_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
      body: JSON.stringify(buildRequest(question, earlier)),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    if (!response.body) return { kind: 'fallback', reason: 'unknown' };
    const body = response.body;
    const chunks = (async function* () {
      try {
        yield* readText(body);
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    })();
    return {
      kind: 'stream',
      chunks,
      remaining: count(response.headers.get(REMAINING_HEADER)),
      limit: count(response.headers.get(LIMIT_HEADER)),
    };
  }

  signal?.removeEventListener('abort', abort);
  const retryAfter = () => parseRetryAfter(response.headers.get('Retry-After'));
  switch (await errorCode(response)) {
    case 'limit_reached':
      return { kind: 'limit_reached' };
    case 'busy':
      return { kind: 'busy', retryAfter: retryAfter() };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'invalid_request':
      return { kind: 'fallback', reason: 'invalid_request' };
    case 'forbidden':
      return { kind: 'fallback', reason: 'forbidden' };
    case 'upstream':
      return { kind: 'fallback', reason: 'upstream' };
  }
  // No contract body: the platform answered instead (a missing route, a firewall, a timeout).
  switch (response.status) {
    case 404:
    case 501:
    case 503:
      return { kind: 'unavailable' };
    case 429:
      return { kind: 'busy', retryAfter: retryAfter() };
    case 502:
    case 504:
      return { kind: 'fallback', reason: 'upstream' };
    default:
      return { kind: 'fallback', reason: 'unknown' };
  }
}
