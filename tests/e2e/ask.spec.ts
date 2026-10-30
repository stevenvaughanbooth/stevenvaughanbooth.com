import { expect, type Page, type Route, test } from '@playwright/test';
import { person } from '@/content/profile';
import { LIMIT_HEADER, REMAINING_HEADER, VISITOR_LIMIT } from '@/lib/ask-contract';
import {
  askTrigger as headerTrigger,
  axeViolations,
  focusIsWithin,
  hydrated,
  palette,
} from './helpers';

const input = (page: Page) => page.getByRole('combobox', { name: 'Ask a question or search' });
const turn = (page: Page, question: string) =>
  palette(page).getByRole('article', { name: question });

interface Mock {
  status: { enabled: boolean; limit: number; remaining: number };
  answer?: (route: Route) => Promise<void>;
}

/** Stands in for /api/ask, and records what the palette sends. */
async function mockAsk(page: Page, { status, answer }: Mock) {
  const sent: unknown[] = [];
  await page.route('**/api/ask', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: status });
    sent.push(route.request().postDataJSON());
    return answer ? answer(route) : route.fulfill({ status: 500 });
  });
  return sent;
}

/** Opens the palette from the header, once the page is interactive. */
async function openPalette(page: Page) {
  await hydrated(page);
  await headerTrigger(page).click();
  await expect(palette(page)).toBeVisible();
}

/** Asks a free-form question in the open palette. */
async function ask(page: Page, question: string) {
  await input(page).fill(question);
  await input(page).press('Enter');
}

test('⌘K / Ctrl+K opens the palette and Escape returns focus to the trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = headerTrigger(page);
  await trigger.focus();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
  await expect.poll(() => focusIsWithin(palette(page))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('the header button opens the palette and Escape closes it', async ({ page }) => {
  await page.goto('/');
  const trigger = headerTrigger(page);
  await expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');

  await trigger.click();
  await expect(palette(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test.describe('loading', () => {
  // A string only the palette's own chunk contains.
  const paletteMarker = 'Ask a question or search';

  test('the palette code loads only on intent', async ({ page }) => {
    const scripts: Promise<string>[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script') scripts.push(response.text());
    });
    const paletteLoaded = async () =>
      (await Promise.all(scripts)).some((body) => body.includes(paletteMarker));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Let the browser go idle twice, where an idle-time prefetch would have run.
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve)));
    }
    await page.waitForLoadState('networkidle');
    expect(await paletteLoaded(), 'palette code requested before any intent').toBe(false);

    // Pointing at an Ask button is intent enough: the code starts downloading before the click.
    await headerTrigger(page).hover();
    await expect.poll(paletteLoaded).toBe(true);
    await expect(palette(page)).toBeHidden();
  });

  test('a palette that fails to load leaves the page up, and Try again recovers', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');

    // From here on, every script the page asks for fails: the palette's chunk among them.
    const failScripts = (route: Route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.fallback();
    await page.route('**/_next/static/chunks/**', failScripts);
    await headerTrigger(page).click();

    const notice = page.getByRole('region', { name: 'Ask Steven couldn’t load.' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Try again' })).toBeFocused();
    await expect(notice.getByRole('link', { name: 'Email Steven' })).toHaveAttribute(
      'href',
      `mailto:${person.email}`,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(person.name);

    await page.unroute('**/_next/static/chunks/**', failScripts);
    await notice.getByRole('button', { name: 'Try again' }).click();
    await expect(palette(page)).toBeVisible();
    await expect(notice).toBeHidden();
  });
});

test.describe('answers', () => {
  test('live: answers come from Claude, with the questions left', async ({ page }) => {
    let remaining = VISITOR_LIMIT;
    const sent = await mockAsk(page, {
      status: { enabled: true, limit: VISITOR_LIMIT, remaining },
      answer: (route) => {
        remaining -= 1;
        return route.fulfill({
          contentType: 'text/plain; charset=utf-8',
          headers: { [REMAINING_HEADER]: String(remaining), [LIMIT_HEADER]: String(VISITOR_LIMIT) },
          body: `Answer ${VISITOR_LIMIT - remaining}, in plain text.`,
        });
      },
    });
    await page.goto('/');
    await openPalette(page);
    await expect(palette(page)).toContainText(
      `Live answers by Claude · ${VISITOR_LIMIT} of ${VISITOR_LIMIT} questions left`,
    );

    const first = 'Why does Steven want to work at Anthropic?';
    await ask(page, first);
    await expect(turn(page, first)).toContainText('Answer 1, in plain text.');
    await expect(turn(page, first)).toContainText(
      'Answered by Claude from Steven’s public profile',
    );
    await expect(turn(page, first)).toContainText(
      `· ${VISITOR_LIMIT - 1} of ${VISITOR_LIMIT} questions left`,
    );

    // A follow-up carries the earlier question as context, never the earlier answer.
    const second = 'And what would he want to build there?';
    await ask(page, second);
    await expect(turn(page, second)).toContainText('Answer 2, in plain text.');
    expect(sent).toEqual([{ question: first }, { question: second, history: [first] }]);
    await expect(palette(page)).toContainText(
      `Live answers by Claude · ${VISITOR_LIMIT - 2} of ${VISITOR_LIMIT} questions left`,
    );
  });

  test('used up: the palette points to email and asks Claude nothing', async ({ page }) => {
    const sent = await mockAsk(page, {
      status: { enabled: true, limit: VISITOR_LIMIT, remaining: 0 },
    });
    await page.goto('/');
    await openPalette(page);
    await expect(palette(page)).toContainText('Live questions used');

    const question = 'Is Steven open to relocating?';
    await ask(page, question);
    const reply = turn(page, question);
    await expect(reply).toContainText('That’s all the live questions for now.');
    await expect(reply.getByRole('link', { name: 'Email Steven' })).toHaveAttribute(
      'href',
      person.links.email,
    );
    // No curated topic stands in for an answer the notes don't have.
    await expect(reply).not.toContainText('From Steven’s curated notes');
    expect(sent).toEqual([]);
  });

  test('busy: the curated notes answer, with a retry', async ({ page }) => {
    await mockAsk(page, {
      status: { enabled: true, limit: VISITOR_LIMIT, remaining: VISITOR_LIMIT },
      answer: (route) =>
        route.fulfill({ status: 429, json: { error: 'busy' }, headers: { 'Retry-After': '20' } }),
    });
    await page.goto('/');
    await openPalette(page);
    await expect(palette(page)).toContainText('Live answers by Claude');

    const question = 'Could you explain how Adage reflexes work in practice?';
    await ask(page, question);
    const reply = turn(page, question);
    await expect(reply).toContainText('Claude is busy right now.');
    await expect(reply).toContainText('Try again in about 20 seconds.');
    await expect(reply).toContainText('here’s what Steven’s notes say');
    await expect(reply).toContainText('From Steven’s curated notes');
    await expect(reply.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('off: without live answers, the curated notes say what they cover', async ({ page }) => {
    // The real route: this server has no key or Redis, so live answers are off.
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ask') {
        posts.push(request.url());
      }
    });
    const status = await (await page.request.get('/api/ask')).json();
    test.skip(status.enabled, 'live answers are configured on this server');

    await page.goto('/');
    await openPalette(page);
    await expect(palette(page)).toContainText('Curated answers · live answers are off');

    const question = 'Why does Steven want to work at Anthropic?';
    await ask(page, question);
    const reply = turn(page, question);
    await expect(reply).toContainText('That isn’t covered in Steven’s curated notes');
    await expect(reply.getByRole('link', { name: 'Email Steven' })).toBeVisible();
    expect(posts).toEqual([]);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the open palette has no serious or critical axe violations (${colorScheme})`, async ({
    page,
  }) => {
    // The palette's opening transition is off under reduced motion, so contrast is measured at rest.
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mockAsk(page, { status: { enabled: true, limit: VISITOR_LIMIT, remaining: 2 } });
    await page.goto('/');
    await openPalette(page);
    await expect(palette(page)).toContainText(`2 of ${VISITOR_LIMIT} questions left`);

    // The results list, then the first topic's curated answer in the conversation view.
    expect(await axeViolations(page, (axe) => axe.include('dialog[open]'))).toEqual([]);
    await input(page).press('Enter');
    await expect(palette(page).getByRole('article')).toBeVisible();
    expect(await axeViolations(page, (axe) => axe.include('dialog[open]'))).toEqual([]);
  });
}
