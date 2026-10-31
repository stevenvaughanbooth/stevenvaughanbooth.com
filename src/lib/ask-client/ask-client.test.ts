import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANSWER_CONTENT_TYPE, HISTORY_MAX_ITEMS, QUESTION_MAX } from '@/lib/ask-contract';
import {
  type AnswerEvent,
  askClaude,
  buildRequest,
  getAskStatus,
  parseEvent,
  parseRetryAfter,
  readEvents,
} from '.';

function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The answer's text and actions, the way the palette reads them. */
async function collect(events: AsyncGenerator<AnswerEvent>) {
  let text = '';
  const actions: string[] = [];
  for await (const event of events) {
    if (event.type === 'text') text += event.text;
    else actions.push(event.target);
  }
  return { text, actions };
}

const ndjson = (...events: unknown[]) => events.map((event) => `${JSON.stringify(event)}\n`);

afterEach(() => vi.unstubAllGlobals());

describe('getAskStatus', () => {
  it('returns the allowance', async () => {
    const fetchMock = mockFetch(json(200, { enabled: true, limit: 3, remaining: 2 }));
    await expect(getAskStatus()).resolves.toEqual({ enabled: true, limit: 3, remaining: 2 });
    expect(fetchMock).toHaveBeenCalledWith('/api/ask', expect.objectContaining({ method: 'GET' }));
  });

  it('returns null when the route is missing, fails, or answers nonsense', async () => {
    mockFetch(json(404, { error: 'not found' }));
    await expect(getAskStatus()).resolves.toBeNull();
    mockFetch(new TypeError('Failed to fetch'));
    await expect(getAskStatus()).resolves.toBeNull();
    mockFetch(json(200, { enabled: 'yes', limit: 3 }));
    await expect(getAskStatus()).resolves.toBeNull();
  });

  it('never reports more remaining than the limit', async () => {
    mockFetch(json(200, { enabled: true, limit: 3, remaining: 9 }));
    await expect(getAskStatus()).resolves.toMatchObject({ remaining: 3 });
  });
});

describe('buildRequest', () => {
  it('clamps the question and keeps only the most recent earlier questions', () => {
    const earlier = Array.from({ length: 6 }, (_, i) => `${i} ${'x'.repeat(2000)}`);
    const body = buildRequest(`  ${'q'.repeat(500)}  `, earlier);
    expect(body.question).toHaveLength(QUESTION_MAX);
    expect(body.history).toHaveLength(HISTORY_MAX_ITEMS);
    expect(body.history?.[0]?.startsWith(`${6 - HISTORY_MAX_ITEMS} `)).toBe(true);
    body.history?.forEach((question) => expect(question.length).toBeLessThanOrEqual(QUESTION_MAX));
  });

  it('tidies whitespace, drops blank questions and omits empty history', () => {
    expect(buildRequest(' Next?\n ', ['  ', ' Who   is Steven? '])).toEqual({
      question: 'Next?',
      history: ['Who is Steven?'],
    });
    expect(buildRequest('Hi')).toEqual({ question: 'Hi' });
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds or an HTTP date', () => {
    expect(parseRetryAfter('12')).toBe(12);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('readEvents', () => {
  const read = (chunks: string[], type: string | null = ANSWER_CONTENT_TYPE) =>
    collect(readEvents(textStream(chunks), type));

  it('reassembles lines split anywhere, including inside a multi-byte character', async () => {
    const joined = ndjson({ type: 'text', text: 'Steven’s ' }, { type: 'text', text: 'work' }).join(
      '',
    );
    const bytes = new TextEncoder().encode(joined);
    const cut = new TextEncoder().encode(joined.slice(0, joined.indexOf('’'))).length + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 5));
        controller.enqueue(bytes.slice(5, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    await expect(collect(readEvents(body, ANSWER_CONTENT_TYPE))).resolves.toEqual({
      text: 'Steven’s work',
      actions: [],
    });
  });

  it('checks actions against the allowlist again, and skips what it does not know', async () => {
    await expect(
      read(
        ndjson(
          { type: 'text', text: 'Here.' },
          { type: 'action', target: 'javascript:alert(1)' },
          { type: 'action', target: '../../admin' },
          { type: 'action', target: 'film' },
          { type: 'action', target: 42 },
          { type: 'sparkle', text: 'from a newer server' },
          { type: 'action', target: 'recognition' },
        ),
      ),
    ).resolves.toEqual({ text: 'Here.', actions: ['recognition'] });
  });

  it('reads a final line without a newline', async () => {
    await expect(read(['{"type":"text","text":"Done"}'])).resolves.toEqual({
      text: 'Done',
      actions: [],
    });
  });

  it('throws on a line that is not JSON, so the answer reads as cut off', async () => {
    await expect(read(['{"type":"text","text":"Half', '\n'])).rejects.toThrow();
  });

  it('reads plain text from a server that predates actions', async () => {
    await expect(read(['{"type":"action"} is ', 'just text'], 'text/plain')).resolves.toEqual({
      text: '{"type":"action"} is just text',
      actions: [],
    });
  });

  it('parses one event per line', () => {
    expect(parseEvent('  ')).toBeNull();
    expect(parseEvent('null')).toBeNull();
    expect(parseEvent('{"type":"text","text":7}')).toBeNull();
    expect(parseEvent('{"type":"action","target":"work-mcp"}')).toEqual({
      type: 'action',
      target: 'work-mcp',
    });
  });
});

describe('askClaude', () => {
  it('streams the answer’s events and reads the allowance headers', async () => {
    const fetchMock = mockFetch(
      new Response(
        textStream(
          ndjson(
            { type: 'text', text: 'Steven builds ' },
            { type: 'text', text: 'platforms.' },
            { type: 'action', target: 'work-platform' },
          ),
        ),
        {
          status: 200,
          headers: {
            'Content-Type': ANSWER_CONTENT_TYPE,
            'X-Ask-Remaining': '1',
            'X-Ask-Limit': '3',
          },
        },
      ),
    );
    const outcome = await askClaude('What does Steven build?', ['Who is Steven?']);
    expect(outcome.kind).toBe('stream');
    if (outcome.kind !== 'stream') return;
    expect(outcome.remaining).toBe(1);
    expect(outcome.limit).toBe(3);
    await expect(collect(outcome.events)).resolves.toEqual({
      text: 'Steven builds platforms.',
      actions: ['work-platform'],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ask');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      question: 'What does Steven build?',
      history: ['Who is Steven?'],
    });
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('Steven’s work');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8));
        controller.enqueue(bytes.slice(8));
        controller.close();
      },
    });
    mockFetch(new Response(body, { status: 200 }));
    const outcome = await askClaude('?');
    if (outcome.kind !== 'stream') throw new Error('expected a stream');
    await expect(collect(outcome.events)).resolves.toEqual({ text: 'Steven’s work', actions: [] });
  });

  it.each([
    [json(429, { error: 'limit_reached', remaining: 0 }), { kind: 'limit_reached' }],
    [json(429, { error: 'busy' }, { 'Retry-After': '20' }), { kind: 'busy', retryAfter: 20 }],
    [json(503, { error: 'unavailable' }), { kind: 'unavailable' }],
    [json(404, {}), { kind: 'unavailable' }],
    [json(400, { error: 'invalid_request' }), { kind: 'fallback', reason: 'invalid_request' }],
    [json(403, { error: 'forbidden' }), { kind: 'fallback', reason: 'forbidden' }],
    [json(502, { error: 'upstream' }), { kind: 'fallback', reason: 'upstream' }],
    [new Response('oops', { status: 500 }), { kind: 'fallback', reason: 'unknown' }],
    // Without the contract's body, the status decides: a firewall's 429, a gateway timeout.
    [
      new Response('', { status: 429, headers: { 'Retry-After': '5' } }),
      { kind: 'busy', retryAfter: 5 },
    ],
    [new Response('', { status: 504 }), { kind: 'fallback', reason: 'upstream' }],
    [json(503, { error: 'something new' }), { kind: 'unavailable' }],
  ])('maps status %# to its outcome', async (response, expected) => {
    mockFetch(response);
    await expect(askClaude('Hello?')).resolves.toEqual(expected);
  });

  it('treats a network failure as live answers being off', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(askClaude('Hello?')).resolves.toEqual({ kind: 'unavailable' });
  });

  it('rethrows when the caller aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );
    const pending = askClaude('Hello?', [], controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('Aborted');
  });
});
