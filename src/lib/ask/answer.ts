import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { person } from '@/content/profile';
import { logAskError } from './log';
import { SYSTEM_PROMPT } from './prompt';
import type { ParsedAskRequest } from './schema';

/** Fast and inexpensive, and ample for short answers grounded in a fixed public profile. */
const MODEL = 'claude-haiku-5-5';
/**
 * Thinking counts toward max_tokens alongside the reply. A 120-word answer is about 200 tokens and
 * low-effort adaptive thinking on a grounded question is usually a few hundred more, so 2048 leaves
 * several times that headroom against truncation while capping the worst case at about $0.001 of
 * output per question ($0.50 per million output tokens).
 */
const MAX_TOKENS = 2048;
/** Ends the stream gracefully before the route's 30 s maxDuration would cut it off. */
const DEADLINE_MS = 25_000;

const DECLINED = `That's not something I can help with here. For anything else, email Steven at ${person.email}.`;
const RETRY = `Please try again, or email Steven at ${person.email}.`;

let cached: { apiKey: string; client: Anthropic } | undefined;

function client(apiKey: string): Anthropic {
  if (cached?.apiKey !== apiKey) {
    cached = {
      apiKey,
      client: new Anthropic({
        apiKey,
        // Pinned, so no environment variable can send the key to another host.
        baseURL: 'https://api.anthropic.com',
        // Two attempts at most: the visitor is waiting and the route has 30 seconds.
        maxRetries: 1,
        timeout: 10_000,
        // Requests carry visitors' questions. Keep them out of logs and traces entirely.
        logLevel: 'off',
        openTelemetry: false,
      }),
    };
  }
  return cached.client;
}

interface AnswerOptions extends ParsedAskRequest {
  apiKey: string;
  /** Aborted when the visitor disconnects. */
  signal: AbortSignal;
}

/**
 * The visitor's turn. Earlier questions come along as context so a follow-up makes sense, but
 * earlier answers never do: they would come from the browser, so the server could not trust them.
 */
function visitorTurn(question: string, history: string[]): string | Anthropic.ContentBlockParam[] {
  if (history.length === 0) return question;
  const earlier = history.map((text) => `- ${text}`).join('\n');
  return [
    { type: 'text', text: `Earlier questions from this visitor, for context only:\n${earlier}` },
    { type: 'text', text: question },
  ];
}

/**
 * Starts a streamed answer and resolves once the first event has arrived, so an upstream failure
 * still becomes an HTTP error status rather than a broken 200. The returned stream carries only
 * the answer's text.
 */
export async function startAnswer({
  apiKey,
  question,
  history,
  signal,
}: AnswerOptions): Promise<ReadableStream<Uint8Array>> {
  const deadline = AbortSignal.timeout(DEADLINE_MS);

  const stream = client(apiKey).messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Haiku 5.5 defaults to medium effort; low is plenty for short grounded answers. It has no
      // server-side refusal fallback, so a declined answer ends with the note in finish() below.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      // Visitors usually ask their questions minutes apart, inside the default 5-minute cache.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: visitorTurn(question, history) }],
    },
    { signal: AbortSignal.any([signal, deadline]) },
  );

  const events = stream[Symbol.asyncIterator]();
  let next: Promise<IteratorResult<Anthropic.RawMessageStreamEvent>> | undefined = events.next();
  await next;

  const encoder = new TextEncoder();
  let wroteText = false;
  let stopReason: Anthropic.StopReason | null = null;

  const write = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) => {
    controller.enqueue(encoder.encode(text));
    wroteText = true;
  };
  const cutShort = (controller: ReadableStreamDefaultController<Uint8Array>) =>
    write(
      controller,
      wroteText
        ? `\n\nThe answer was cut short. ${RETRY}`
        : `Sorry, I couldn't answer just now. ${RETRY}`,
    );

  const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (stopReason === 'refusal') {
      // A safety classifier declined. Anything already streamed is partial, so say so.
      console.warn('[ask] refusal');
      write(controller, wroteText ? `\n\n${DECLINED}` : DECLINED);
    } else if (stopReason === null || stopReason === 'max_tokens') {
      // Ended without a final stop reason (dropped upstream) or ran out of tokens.
      console.warn(`[ask] incomplete: ${stopReason ?? 'no stop reason'}`);
      cutShort(controller);
    } else if (!wroteText) {
      write(controller, DECLINED);
    }
    controller.close();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const result = await (next ?? events.next());
          next = undefined;
          if (result.done) {
            if (signal.aborted) controller.close();
            else finish(controller);
            return;
          }
          const event = result.value;
          if (event.type === 'message_delta' && event.delta.stop_reason) {
            stopReason = event.delta.stop_reason;
          } else if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            event.delta.text
          ) {
            write(controller, event.delta.text);
            return;
          }
        }
      } catch (err) {
        if (signal.aborted) {
          controller.close();
          return;
        }
        logAskError(deadline.aborted ? 'deadline' : 'stream', err);
        cutShort(controller);
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
}
