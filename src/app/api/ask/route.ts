import 'server-only';
import { checkBotId } from 'botid/server';
import {
  ANSWER_CONTENT_TYPE,
  ASK_ERRORS,
  type AskErrorCode,
  type AskStatus,
  LIMIT_HEADER,
  REMAINING_HEADER,
  VISITOR_LIMIT,
} from '@/lib/ask-contract';
import { type AnswerFormat, startAnswer } from '@/lib/ask/answer';
import { getAskConfig } from '@/lib/ask/config';
import { logAsk, logAskError } from '@/lib/ask/log';
import { isSameOrigin } from '@/lib/ask/origin';
import { consume, type Decision, networkKey, refund, type Requester } from '@/lib/ask/rate-limit';
import { readAskRequest } from '@/lib/ask/schema';
import { readVisitor, remainingHint, visitorCookie, visitorKeys } from '@/lib/ask/visitor';

export const runtime = 'nodejs';
export const maxDuration = 30;

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: object, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function error(code: AskErrorCode, headers: Record<string, string> = {}): Response {
  const body = code === 'limit_reached' ? { error: code, remaining: 0 } : { error: code };
  return json(body, ASK_ERRORS[code], headers);
}

const limitHeaders = (remaining: number) => ({
  [REMAINING_HEADER]: String(remaining),
  [LIMIT_HEADER]: String(VISITOR_LIMIT),
});

/**
 * The answer's format, by the request's Accept header. The client from before page actions sends
 * `Accept: text/plain` and shows the body exactly as it arrives, so a tab still running it gets
 * the plain text it expects; the current client accepts NDJSON. Drop the plain-text answer once
 * tabs from that release have aged out.
 */
function answerFormat(request: Request): AnswerFormat {
  return request.headers.get('accept')?.includes('application/x-ndjson') ? 'ndjson' : 'text';
}

const PLAIN_TEXT = 'text/plain; charset=utf-8';

/** `__Host-` and Secure everywhere but `next dev`, which may be reached over plain HTTP. */
const secureCookies = () => process.env.NODE_ENV !== 'development';

/**
 * Whether live answers are on, and how many questions this visitor has left. It reads only the
 * environment and the visitor's signed cookie, never Redis, so polling it costs nothing upstream.
 * The kill switch in Redis is honored by POST, which then answers 503 and the palette falls back.
 */
export async function GET(request: Request): Promise<Response> {
  const config = getAskConfig();
  if (!config) {
    return json({ enabled: false, limit: VISITOR_LIMIT, remaining: 0 } satisfies AskStatus);
  }
  const key = visitorKeys(config.apiKey).cookie;
  const secure = secureCookies();
  const visitor = readVisitor(request.headers, key, { secure });
  return json(
    { enabled: true, limit: VISITOR_LIMIT, remaining: remainingHint(visitor) } satisfies AskStatus,
    200,
    { 'Set-Cookie': visitorCookie(visitor, key, { secure }) },
  );
}

/**
 * Streams a grounded answer as newline-delimited JSON: its text, then at most one allowlisted
 * place on the site to show. A client that does not accept NDJSON gets the text alone, as plain
 * text. See docs/architecture.md for the contract.
 */
export async function POST(request: Request): Promise<Response> {
  // Cheapest checks first; nothing below runs, and no money is spent, unless all of them pass.
  // Origin and validation come before configuration so they hold (and are testable) everywhere.
  if (!isSameOrigin(request.headers, { dev: process.env.NODE_ENV === 'development' })) {
    return error('forbidden');
  }

  const parsed = await readAskRequest(request);
  if (!parsed.ok) return error('invalid_request');

  const config = getAskConfig();
  if (!config) return error('unavailable');

  let verdict: Awaited<ReturnType<typeof checkBotId>>;
  try {
    verdict = await checkBotId();
  } catch (err) {
    logAskError('botid', err);
    return error('unavailable');
  }
  // checkBotId reads the service's JSON without checking its HTTP status, so an outage can come
  // back as a "verdict" with no isBot at all. Only a definite answer counts; anything else fails
  // closed.
  if (typeof verdict.isBot !== 'boolean') {
    logAsk('botid', 'no verdict');
    return error('unavailable');
  }
  if (verdict.isBot || verdict.isVerifiedBot) return error('forbidden');

  const keys = visitorKeys(config.apiKey);
  const secure = secureCookies();
  const now = Date.now();
  let visitor = readVisitor(request.headers, keys.cookie, { secure, now });
  const who: Requester = {
    visitor: visitor.id,
    network: networkKey(request.headers, keys.network),
  };
  // Every response from here on stores the visitor, so a new id sticks and the hint stays current.
  const withVisitor = (headers: Record<string, string> = {}) => ({
    ...headers,
    'Set-Cookie': visitorCookie(visitor, keys.cookie, { secure }),
  });

  let decision: Decision;
  try {
    decision = await consume(config.redis, who);
  } catch (err) {
    logAskError('ratelimit', err);
    return error('unavailable', withVisitor());
  }
  if (!decision.ok) {
    switch (decision.reason) {
      case 'disabled':
      case 'closed':
        // The palette answers from curated notes until live answers are back.
        return error('unavailable', withVisitor());
      case 'limit_reached':
        visitor = { ...visitor, remaining: 0, issuedAt: now };
        return error('limit_reached', withVisitor(limitHeaders(0)));
      case 'busy':
        return error('busy', withVisitor({ 'Retry-After': String(decision.retryAfter) }));
    }
  }

  const format = answerFormat(request);
  let body: ReadableStream<Uint8Array>;
  try {
    body = await startAnswer({
      apiKey: config.apiKey,
      ...parsed.data,
      signal: request.signal,
      format,
    });
  } catch (err) {
    // Claude failed before answering, so the question does not count against the visitor, their
    // network or the day. A visitor who disconnected keeps the cost: refunding that would let a
    // script start and cancel questions forever.
    if (!request.signal.aborted) {
      logAskError('upstream', err);
      await refund(config.redis, who);
    }
    return error('upstream', withVisitor());
  }

  visitor = { ...visitor, remaining: decision.remaining, issuedAt: now };
  return new Response(body, {
    headers: {
      'Content-Type': format === 'ndjson' ? ANSWER_CONTENT_TYPE : PLAIN_TEXT,
      ...NO_STORE,
      ...withVisitor(limitHeaders(decision.remaining)),
    },
  });
}
