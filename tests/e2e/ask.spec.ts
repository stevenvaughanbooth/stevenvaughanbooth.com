import { expect, type Page, type Route, test } from '@playwright/test';
import { heroSuggestions } from '@/content/answers';
import { person, themes } from '@/content/profile';
import {
  ANSWER_CONTENT_TYPE,
  LIMIT_HEADER,
  REMAINING_HEADER,
  VISITOR_LIMIT,
} from '@/lib/ask-contract';
import { caseStudyAnchors, pageTargets } from '@/lib/page-targets';
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

/** A 200 answer body as the route streams it: one JSON event per line. */
const answerBody = (...events: unknown[]) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join('');

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
          contentType: ANSWER_CONTENT_TYPE,
          headers: { [REMAINING_HEADER]: String(remaining), [LIMIT_HEADER]: String(VISITOR_LIMIT) },
          body: answerBody(
            { type: 'text', text: `Answer ${VISITOR_LIMIT - remaining}, ` },
            { type: 'text', text: 'in plain text.' },
          ),
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

test.describe('answers that act', () => {
  test('every place an answer can show exists, with a heading to land on', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    for (const target of pageTargets) {
      if (target.anchor) {
        const element = page.locator(`#${target.anchor}`);
        await expect(element, target.id).toHaveCount(1);
        // Roles land on their summary; everything else on its first heading.
        const landing = target.kind === 'role' ? 'summary' : 'h2, h3';
        await expect(element.locator(landing).first(), target.id).toBeAttached();
      } else {
        const response = await request.get(target.href);
        expect(response.status(), target.id).toBe(200);
      }
    }
    // A theme's diagram also heads its case study, and the case study lands on its title there.
    const elsewhere = Map.groupBy(
      pageTargets.flatMap((target) => (target.alsoOn ? [target.alsoOn] : [])),
      (place) => place.path,
    );
    expect([...elsewhere.keys()].sort()).toEqual(['/work/devtools', '/work/mcp', '/work/platform']);
    for (const [path, places] of elsewhere) {
      await page.goto(path);
      for (const { anchor } of places) {
        await expect(page.locator(`#${anchor}`), `${path}#${anchor}`).toHaveCount(1);
      }
    }
  });

  test('“Show me” moves to the place, focuses it and records it in the URL', async ({ page }) => {
    await page.goto('/');
    await openPalette(page);
    await ask(page, 'Tell me about the Core Metadata Platform');
    const reply = turn(page, 'Tell me about the Core Metadata Platform');
    const show = reply.getByRole('button', { name: 'Show me the platform diagram' });
    await expect(show).toBeVisible();
    // Offering a place never moves the page by itself.
    await expect(palette(page)).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');

    await show.click();
    await expect(palette(page)).toBeHidden();
    await expect(page.locator('#work-platform-title')).toBeFocused();
    await expect(page.locator('#work-platform-title')).toBeInViewport();
    expect(new URL(page.url()).hash).toBe('#work-platform');
  });

  test('an explicit request moves the page straight away', async ({ page }) => {
    await page.goto('/');
    await openPalette(page);
    await ask(page, 'Take me to his awards');
    await expect(palette(page)).toBeHidden();
    const awards = page.locator('#recognition h3');
    await expect(awards).toBeFocused();
    await expect(awards).toBeInViewport();
    expect(new URL(page.url()).hash).toBe('#recognition');
  });

  test('a career role opens on the timeline, as the only open role', async ({ page }) => {
    await page.goto('/');
    await openPalette(page);
    await ask(page, 'Show me the lead engineer role');
    await expect(palette(page)).toBeHidden();
    const role = page.locator('#role-lead-engineer');
    await expect(role.locator('details')).toHaveAttribute('open', '');
    await expect(role.locator('summary')).toBeFocused();
    await expect(page.locator('details[name="career-role"][open]')).toHaveCount(1);
  });

  test('a case study opens as a page of its own', async ({ page }) => {
    await page.goto('/');
    await openPalette(page);
    await ask(page, 'How do you design APIs for agents?');
    const link = turn(page, 'How do you design APIs for agents?').getByRole('link', {
      name: /Read the MCP case study/,
    });
    await expect(link).toHaveAttribute('href', '/work/mcp');
    await link.click();
    await page.waitForURL('**/work/mcp');
  });

  test('on a case study, “Ask about this” shows the diagram on that page and stays there', async ({
    page,
  }) => {
    const prompt = themes.find((theme) => theme.id === 'mcp')!.prompt;
    await page.goto('/work/mcp');
    await hydrated(page);
    await page.getByRole('button', { name: 'Ask about this' }).click();
    const reply = turn(page, prompt);
    await expect(reply).toContainText('The MCP diagram steps through how the context narrows.');
    await expect(reply).not.toContainText('Work section');
    // One place, on this page: no link to the page the visitor is already on.
    const places = reply.getByRole('list', { name: 'On this site' });
    await expect(places.getByRole('listitem')).toHaveCount(1);
    await expect(places.getByRole('link')).toHaveCount(0);

    await places.getByRole('button', { name: 'Show me the MCP diagram' }).click();
    await expect(palette(page)).toBeHidden();
    const diagram = page.locator(`#${caseStudyAnchors.diagram}`);
    await expect(diagram).toBeFocused();
    await expect(diagram).toBeInViewport();
    const url = new URL(page.url());
    expect(`${url.pathname}${url.hash}`).toBe('/work/mcp#diagram');
  });

  test('a live answer offers its place; it moves the page only for a request to be shown', async ({
    page,
  }) => {
    await mockAsk(page, {
      status: { enabled: true, limit: VISITOR_LIMIT, remaining: VISITOR_LIMIT },
      answer: (route) =>
        route.fulfill({
          contentType: ANSWER_CONTENT_TYPE,
          headers: { [REMAINING_HEADER]: '2', [LIMIT_HEADER]: String(VISITOR_LIMIT) },
          body: answerBody(
            { type: 'text', text: 'Adage learns the repeatable parts of agent work.' },
            { type: 'action', target: 'open-source' },
          ),
        }),
    });
    await page.goto('/');
    await openPalette(page);

    const question = 'What would Steven enjoy building next?';
    await ask(page, question);
    await expect(
      turn(page, question).getByRole('button', { name: 'Show me the Adage demo' }),
    ).toBeVisible();
    await expect(palette(page)).toBeVisible();

    await ask(page, 'Show me something surprising');
    await expect(palette(page)).toBeHidden();
    await expect(page.locator('#open-source-title')).toBeFocused();
  });

  test('under reduced motion the page jumps rather than glides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await openPalette(page);
    await ask(page, 'Take me to contact');
    await expect(palette(page)).toBeHidden();
    // No smooth scroll to wait for: the section is in place at once.
    await expect(page.locator('#contact-title')).toBeInViewport();
    await expect(page.locator('#contact-title')).toBeFocused();
  });
});

test.describe('hero ask bar', () => {
  const bar = (page: Page) => page.getByRole('form', { name: 'Ask about my work' });
  const field = (page: Page) => bar(page).getByRole('textbox', { name: 'Ask about my work' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await hydrated(page);
  });

  test('a typed question opens the palette and answers it', async ({ page }) => {
    await field(page).fill('What is Adage?');
    await field(page).press('Enter');
    await expect(palette(page)).toBeVisible();
    await expect(turn(page, 'What is Adage?')).toContainText('From Steven’s curated notes');
    await expect(field(page)).toHaveValue('');

    await page.keyboard.press('Escape');
    await expect(palette(page)).toBeHidden();
    await expect(field(page)).toBeFocused();
  });

  test('“/” focuses the bar, but not while typing elsewhere', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(field(page)).toBeFocused();
    await page.keyboard.type('mcp/agents');
    await expect(field(page)).toHaveValue('mcp/agents');
  });

  test('“/” opens Ask Steven once the bar has scrolled away, and on other pages', async ({
    page,
  }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.keyboard.press('/');
    await expect(palette(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press('Escape');

    await page.goto('/colophon');
    await hydrated(page);
    await page.keyboard.press('/');
    await expect(palette(page)).toBeVisible();
  });

  test('the suggestion that shows a place moves the page without opening the palette', async ({
    page,
  }) => {
    const suggestion = heroSuggestions.at(-1) ?? '';
    await page
      .getByRole('group', { name: 'Try' })
      .getByRole('button', { name: suggestion })
      .click();
    await expect(page.locator('#work-platform-title')).toBeFocused();
    await expect(page.locator('#work-platform-title')).toBeInViewport();
    await expect(palette(page)).toBeHidden();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no serious or critical axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await field(page).focus();
      expect(await axeViolations(page, (axe) => axe.include('main section:first-of-type'))).toEqual(
        [],
      );
    });
  }
});
