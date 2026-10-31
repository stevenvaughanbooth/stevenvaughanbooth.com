// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAnswer } from './answer';

/**
 * The answer stream over the real SDK: its MessageStream parses a fake SSE body, so tool input
 * it cannot parse fails the way it does in production, not the way a mock says it does.
 */

const message = {
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [],
  stop_reason: null,
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
};

/** A turn that answers, then calls show_on_page with this input. */
function events(input: string) {
  return [
    { type: 'message_start', message },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Steven designs MCP tools.' },
    },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'toolu_1', name: 'show_on_page', input: {} },
    },
    {
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: input },
    },
    { type: 'content_block_stop', index: 1 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'tool_use', stop_sequence: null },
      usage: { output_tokens: 5 },
    },
    { type: 'message_stop' },
  ];
}

const sse = (list: object[]) =>
  list
    .map(
      (event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');

const errors = vi.fn();
const warnings = vi.fn();
/** The tool input the next request's fake body streams. */
let toolInput = '';
const requested: string[] = [];

// The client is created once per key and keeps the fetch it was created with, so this one fake
// stays in place and reads the current input.
const fakeFetch = vi.fn(async (url: string | URL | Request) => {
  requested.push(String(url));
  return new Response(sse(events(toolInput)), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
});

beforeAll(() => {
  vi.stubGlobal('fetch', fakeFetch);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(errors);
  vi.spyOn(console, 'warn').mockImplementation(warnings);
});

afterEach(() => {
  errors.mockClear();
  warnings.mockClear();
  vi.restoreAllMocks();
  // Only the pinned API host, ever.
  expect(new Set(requested)).toEqual(new Set(['https://api.anthropic.com/v1/messages']));
});

/** Answers one question from a fake SSE body; reads the answer at once, or only later. */
async function answer(input: string, { later = false } = {}) {
  toolInput = input;
  const body = await startAnswer({
    apiKey: 'sk-ant-api03-test-only-not-a-real-key',
    question: 'What does Steven work on?',
    history: [],
    signal: new AbortController().signal,
    format: 'ndjson',
  });
  // Reading later lets the SDK reach the end of the body while no read is waiting.
  if (later) await new Promise((resolve) => setTimeout(resolve, 50));
  const lines = (await new Response(body).text()).split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as { type: string; text?: string; target?: string });
}

describe('startAnswer over the real SDK', () => {
  it('forwards an allowlisted target after the text', async () => {
    expect(await answer('{"target":"work-mcp"}')).toEqual([
      { type: 'text', text: 'Steven designs MCP tools.' },
      { type: 'action', target: 'work-mcp' },
    ]);
    expect(errors).not.toHaveBeenCalled();
  });

  it('ends a complete answer cleanly when the SDK cannot parse the tool input', async () => {
    for (const input of ['{"target":"work-mcp"}{"target":"contact"}', '{"target":"a"]']) {
      for (const later of [false, true]) {
        errors.mockClear();
        warnings.mockClear();
        const label = `${input}, read ${later ? 'later' : 'at once'}`;
        expect(await answer(input, { later }), label).toEqual([
          { type: 'text', text: 'Steven designs MCP tools.' },
        ]);
        expect(errors.mock.calls, label).toEqual([['[ask] tool: invalid input']]);
        expect(warnings, label).not.toHaveBeenCalled();
      }
    }
  });

  it('drops input the SDK parses leniently but the allowlist does not accept', async () => {
    // The SDK's partial parser returns {} for this rather than throwing.
    expect(await answer('{"target": work-mcp}')).toEqual([
      { type: 'text', text: 'Steven designs MCP tools.' },
    ]);
    expect(errors.mock.calls).toEqual([['[ask] tool: invalid input']]);
  });
});
