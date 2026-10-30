import { afterEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_MAX_ITEMS, QUESTION_MAX } from '@/lib/ask-contract';
import { askClaude, buildRequest, getAskStatus, parseRetryAfter } from '.';

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

async function collect(chunks: AsyncGenerator<string>) {
  let text = '';
  for await (const chunk of chunks) text += chunk;
  return text;
}

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

describe('askClaude', () => {
  it('streams text and reads the allowance headers', async () => {
    const fetchMock = mockFetch(
      new Response(textStream(['Steven builds ', 'platforms.']), {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'X-Ask-Remaining': '1', 'X-Ask-Limit': '3' },
      }),
    );
    const outcome = await askClaude('What does Steven build?', ['Who is Steven?']);
    expect(outcome.kind).toBe('stream');
    if (outcome.kind !== 'stream') return;
    expect(outcome.remaining).toBe(1);
    expect(outcome.limit).toBe(3);
    await expect(collect(outcome.chunks)).resolves.toBe('Steven builds platforms.');

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
    await expect(collect(outcome.chunks)).resolves.toBe('Steven’s work');
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
