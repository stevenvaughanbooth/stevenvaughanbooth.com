import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANSWER_CONTENT_TYPE } from '@/lib/ask-contract';
import { askTrigger, hydrated, palette } from './helpers';

/**
 * Guards for the Ask Steven security model (docs/architecture.md). The Anthropic key and the
 * Redis token are server-only; nothing the browser can download may contain them, the SDK that
 * uses them, or the names of the variables that hold them.
 */
const forbidden: [string, RegExp][] = [
  ['Anthropic API key', /sk-ant-[\w-]{8,}/],
  ['Anthropic SDK base URL', /api\.anthropic\.com/],
  ['ANTHROPIC_API_KEY', /ANTHROPIC_API_KEY/],
  ['Redis token variable', /KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN/],
];

function leaks(text: string): string[] {
  const found = forbidden.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  // Compare against the real key when this shell has one, without ever printing it.
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.length > 8 && text.includes(key)) found.push('the configured key value');
  return found;
}

const clientAssets = join(import.meta.dirname, '../../.next/static');

test('client bundles carry no server secrets or the Anthropic SDK', () => {
  test.skip(!existsSync(clientAssets), 'needs a local production build');

  const offenders = readdirSync(clientAssets, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(js|css|json|txt)$/.test(file))
    .flatMap((file) =>
      leaks(readFileSync(join(clientAssets, file), 'utf8')).map((what) => `${file}: ${what}`),
    );

  expect(offenders).toEqual([]);
});

for (const path of ['/', '/colophon']) {
  test(`${path} HTML and inline RSC payload carry no server secrets`, async ({ request }) => {
    const html = await (await request.get(path)).text();
    expect(leaks(html)).toEqual([]);
  });
}

test('pages are served with a locked-down security policy', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  const csp = headers['content-security-policy'] ?? '';

  for (const directive of [
    "default-src 'self'",
    "connect-src 'self'",
    // Inline <script> elements must run (Next.js streams its payload through them, and no nonce
    // is used), but inline event-handler attributes such as onerror= are refused.
    "script-src-attr 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ]) {
    expect(csp).toContain(directive);
  }
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});

test.describe('/api/ask', () => {
  test('GET reports availability and the visitor allowance without caching', async ({
    request,
  }) => {
    const response = await request.get('/api/ask');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');

    const body = await response.json();
    expect(body).toEqual({
      enabled: expect.any(Boolean),
      limit: expect.any(Number),
      remaining: expect.any(Number),
    });
    expect(body.remaining).toBeLessThanOrEqual(body.limit);
    // CI has no key and no Redis, so live answers must fail closed.
    if (process.env.CI) expect(body.enabled).toBe(false);
  });

  test('GET sets the visitor cookie only when live answers are configured', async ({ request }) => {
    const response = await request.get('/api/ask');
    const { enabled } = await response.json();
    const cookie = response.headers()['set-cookie'];
    if (!enabled) {
      // The site sets no cookie at all until live answers are configured.
      expect(cookie).toBeUndefined();
      return;
    }
    // A random id, the questions-left hint and its issue time, signed; HttpOnly and host-only.
    expect(cookie).toMatch(
      /^__Host-ask=[\w-]{22}\.\d\.\d+\.[\w-]{43}; Path=\/; Max-Age=172800; HttpOnly; SameSite=Lax; Secure$/,
    );
  });

  test('rejects cross-origin requests', async ({ request }) => {
    const response = await request.post('/api/ask', {
      headers: { Origin: 'https://attacker.example' },
      data: { question: 'What does Steven work on?' },
    });
    expect(response.status()).toBe(403);
  });

  test('rejects malformed and oversized questions before doing any work', async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    for (const data of [{}, { question: '' }, { question: 'x'.repeat(401) }, { question: 42 }]) {
      const response = await request.post('/api/ask', { headers: { Origin: origin }, data });
      // 400 from validation, or 403 if bot filtering rejects the request first.
      expect([400, 403], JSON.stringify(data).slice(0, 40)).toContain(response.status());
    }
  });

  test('never answers when live answers are not configured', async ({ request, baseURL }) => {
    // Locally a configured key would spend a real question, so this runs only in CI.
    test.skip(!process.env.CI, 'CI only: unconfigured environment');
    const response = await request.post('/api/ask', {
      headers: { Origin: new URL(baseURL!).origin },
      data: { question: 'What does Steven work on?' },
    });
    expect([403, 503]).toContain(response.status());
  });
});

test('a live answer cannot send the page anywhere outside the allowlist', async ({ page }) => {
  await page.route('**/api/ask', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { enabled: true, limit: 3, remaining: 3 } })
      : route.fulfill({
          contentType: ANSWER_CONTENT_TYPE,
          body: [
            { type: 'text', text: 'Somewhere else.' },
            { type: 'action', target: 'javascript:alert(document.domain)' },
            { type: 'action', target: '//attacker.example' },
            { type: 'action', target: 'film' },
          ]
            .map((event) => `${JSON.stringify(event)}\n`)
            .join(''),
        }),
  );
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto('/');
  await hydrated(page);
  await askTrigger(page).click();
  const input = page.getByRole('combobox', { name: 'Ask a question or search' });
  // A request to be shown something, so a valid action would move the page.
  await input.fill('Show me something surprising');
  await input.press('Enter');

  const reply = palette(page).getByRole('article', { name: 'Show me something surprising' });
  await expect(reply).toContainText('Somewhere else.');
  await expect(reply.getByRole('list', { name: 'On this site' })).toHaveCount(0);
  await expect(palette(page)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).hash).toBe('');
  expect(dialogs).toEqual([]);
});
