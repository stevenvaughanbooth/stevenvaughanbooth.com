import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { person } from '@/content/profile';
import type { AskStreamEvent } from '@/lib/ask-contract';
import type { PageTargetId } from '@/lib/page-targets';
import { logAsk, logAskError } from './log';
import { SYSTEM_PROMPT } from './prompt';
import type { ParsedAskRequest } from './schema';
import { parseShowInput, SHOW_TOOL, showOnPageTool } from './show-on-page';

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
/** For a turn that pointed at a place on the site without saying anything first. */
const POINTED = 'Here is where that is on this site.';

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

/**
 * How the answer is written: `ndjson` events (ANSWER_CONTENT_TYPE) for the current client, or
 * `text`, the answer's text alone, for tabs still running the client from before page actions,
 * which shows the body exactly as it arrives.
 */
export type AnswerFormat = 'ndjson' | 'text';

interface AnswerOptions extends ParsedAskRequest {
  apiKey: string;
  /** Aborted when the visitor disconnects. */
  signal: AbortSignal;
  format: AnswerFormat;
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

/** One line of the newline-delimited JSON answer (ANSWER_CONTENT_TYPE). */
const line = (event: AskStreamEvent) => `${JSON.stringify(event)}\n`;

/**
 * Whether the stream failed on the tool call's streamed input, which the SDK could not parse at
 * all. It parses the input at the call's content_block_stop and wraps the SyntaxError in an
 * AnthropicError as its cause. Typed API errors are never this, so they keep their own path.
 */
const isToolInputError = (err: unknown) =>
  err instanceof SyntaxError ||
  (err instanceof Anthropic.AnthropicError &&
    !(err instanceof Anthropic.APIError) &&
    err.cause instanceof SyntaxError);

/**
 * Starts a streamed answer and resolves once the first event has arrived, so an upstream failure
 * still becomes an HTTP error status rather than a broken 200. The returned stream carries the
 * answer's text, then at most one allowlisted action from the show_on_page tool, as
 * newline-delimited JSON; as plain text, it carries the text alone. Thinking and the tool call's
 * raw input never reach the browser.
 */
export async function startAnswer({
  apiKey,
  question,
  history,
  signal,
  format,
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
      // At most one call, which ends the turn. Its result is never sent back, so there is no
      // second request: the call is a pointer for the page, checked below before it is forwarded.
      tools: [showOnPageTool],
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    },
    { signal: AbortSignal.any([signal, deadline]) },
  );

  const events = stream[Symbol.asyncIterator]();
  let next: Promise<IteratorResult<Anthropic.RawMessageStreamEvent>> | undefined = events.next();
  await next;

  const encoder = new TextEncoder();
  let wroteText = false;
  let stopReason: Anthropic.StopReason | null = null;
  /** The show_on_page call while its input streams in; only the first call is read. */
  let call: { index: number; json: string } | null = null;
  let called = false;
  let action: PageTargetId | null = null;

  const write = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) => {
    controller.enqueue(encoder.encode(format === 'ndjson' ? line({ type: 'text', text }) : text));
    wroteText = true;
  };
  const cutShort = (controller: ReadableStreamDefaultController<Uint8Array>) =>
    write(
      controller,
      wroteText
        ? `\n\nThe answer was cut short. ${RETRY}`
        : `Sorry, I couldn't answer just now. ${RETRY}`,
    );

  /**
   * Ends the answer by its stop reason. An action is forwarded only from a turn that finished
   * normally: a refusal or a cut-off turn may have stopped mid-call, so its call is dropped.
   */
  const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (stopReason === 'refusal') {
      // A safety classifier declined. Anything already streamed is partial, so say so.
      console.warn('[ask] refusal');
      write(controller, wroteText ? `\n\n${DECLINED}` : DECLINED);
    } else if (stopReason === null || stopReason === 'max_tokens') {
      // Ended without a final stop reason (dropped upstream) or ran out of tokens.
      console.warn(`[ask] incomplete: ${stopReason ?? 'no stop reason'}`);
      cutShort(controller);
    } else {
      // Plain text has no way to carry the action, so it is dropped there.
      const shown = format === 'ndjson' ? action : null;
      if (!wroteText) write(controller, shown ? POINTED : DECLINED);
      if (shown) controller.enqueue(encoder.encode(line({ type: 'action', target: shown })));
    }
    controller.close();
  };

  /** Reads the tool call's input: fragments while it streams, then a strict parse at its end. */
  const onToolEvent = (event: Anthropic.RawMessageStreamEvent) => {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      // disable_parallel_tool_use allows one call; should another arrive anyway, it is ignored.
      const first = !called && event.content_block.name === SHOW_TOOL;
      called = true;
      if (first) call = { index: event.index, json: '' };
    } else if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'input_json_delta' &&
      call?.index === event.index
    ) {
      call.json += event.delta.partial_json;
    } else if (event.type === 'content_block_stop' && call?.index === event.index) {
      action = parseShowInput(call.json);
      if (!action) logAsk('tool', 'invalid input');
      call = null;
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const result = await (next ?? events.next());
          next = undefined;
          if (result.done) {
            // The SDK's iterator rejects only a read already waiting when the stream fails. A
            // failure between reads just ends the iteration, so take it from the end promise.
            await stream.done();
            if (signal.aborted) controller.close();
            else finish(controller);
            return;
          }
          const event = result.value;
          onToolEvent(event);
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
        if (call && isToolInputError(err)) {
          // The SDK could not parse the tool call's streamed input at all. The answer's text is
          // already complete (the call comes last), so end it there, without an action.
          logAsk('tool', 'invalid input');
          stream.abort();
          if (!wroteText) write(controller, DECLINED);
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
