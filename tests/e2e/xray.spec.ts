import { expect, type Page, test } from '@playwright/test';
import { siteComponents } from '@/content/components';
import { axeViolations, hydrated } from './helpers';

const toggle = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Under the hood', exact: true });
const hud = (page: Page) => page.getByRole('region', { name: 'Under the hood' });
const labels = (page: Page) => page.getByRole('region', { name: 'Components on this page' });
const labelFor = (page: Page, name: string) =>
  labels(page).getByRole('button', { name: new RegExp(`^${name},`) });
const xrayOn = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute('data-xray'));

/** Waits for any colour transitions to finish. */
const settled = (page: Page) =>
  page.waitForFunction(
    () =>
      !document
        .getAnimations()
        .some(
          (animation) => animation instanceof CSSTransition && animation.playState === 'running',
        ),
  );

/** Counts view transitions and their types, as the page starts them. */
async function countTransitions(page: Page) {
  await page.addInitScript(() => {
    const record: string[][] = [];
    Object.assign(window, { transitions: record });
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((options: StartViewTransitionOptions) => {
      record.push([...(options.types ?? [])]);
      return start(options);
    }) as typeof document.startViewTransition;
  });
  return () => page.evaluate(() => (window as unknown as { transitions: string[][] }).transitions);
}

// The components each page draws, from the manifest. How I built this marks its own.
const onHome = siteComponents.filter(
  (component) => component.onPage && !['case-study', 'colophon'].includes(component.id),
);

test('the toggle and X turn X-ray on and off, and the toggle says so', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(hud(page)).toBeVisible();
  expect(await xrayOn(page)).toBe(true);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(hud(page)).toBeHidden();

  await page.keyboard.press('x');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('x');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('every component on the home page is marked, outlined and labelled, in page order', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  for (const component of onHome) {
    await expect(page.locator(`[data-component="${component.id}"]`).first()).toBeAttached();
  }

  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  // A component hidden at this width (the signal on phones, the Sections button on desktop) has
  // no box to label.
  const drawn = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-component]')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => element.dataset.component),
  );
  expect(drawn).toContain(isMobile ? 'sections-menu' : 'signal');
  for (const component of onHome.filter(({ id }) => drawn.includes(id))) {
    await expect(labelFor(page, component.name).first()).toBeAttached();
    const outline = await page
      .locator(`[data-component="${component.id}"]`)
      .first()
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline, component.id).toBe('dashed');
  }
  // One label for each drawn component, in the order the page reads.
  const names = await labels(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.textContent?.match(/<(\w+)/)?.[1]));
  const byId = new Map<string | undefined, string>(
    siteComponents.map((component) => [component.id, component.name]),
  );
  expect(names).toEqual(drawn.map((id) => byId.get(id)));
});

test('a case study marks its article', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/work/mcp');
  await hydrated(page);
  await page.keyboard.press('x');
  await expect(labelFor(page, 'CaseStudyArticle')).toBeVisible();
  await expect(labelFor(page, 'ProgressiveDisclosure')).toBeAttached();
});

test('a label’s details open on focus, link to the source, and close on Escape', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  // The next stop after the toggle (and the Sections button, on phones) is the HUD, then the
  // labels.
  await page.keyboard.press('Tab');
  if (isMobile) await page.keyboard.press('Tab');
  await expect(hud(page).getByRole('button').first()).toBeFocused();

  const label = labelFor(page, 'Hero');
  await label.focus();
  await expect(label).toHaveAttribute('aria-expanded', 'true');
  const card = page.getByRole('group', { name: 'Hero', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Server');
  await expect(card).toContainText('Islands with the page');
  await expect(card).toContainText('hero-ask-bar.tsx, arrival-shell.tsx');
  await expect(
    card.getByRole('link', { name: /src\/components\/sections\/hero\.tsx/ }),
  ).toHaveAttribute(
    'href',
    'https://github.com/stevenvaughanbooth/stevenvaughanbooth.com/blob/main/src/components/sections/hero.tsx',
  );

  // The labels are one Tab stop: the arrow keys move between them, opening each one's card.
  await expect(labels(page).locator('button[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await expect(label).not.toBeFocused();
  await expect(card).toBeHidden();
  await expect(labels(page).locator('button[aria-expanded="true"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(label).toBeFocused();
  await expect(card).toBeVisible();

  // The card doesn't trap focus: Tab goes into it, and Escape from there closes it at once,
  // back on its label.
  await page.keyboard.press('Tab');
  await expect(card.getByRole('link')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(label).toBeFocused();
  await expect(label).toHaveAttribute('aria-expanded', 'false');

  // Tab from the card leaves the labels, and the card closes.
  await label.blur();
  await label.focus();
  await page.keyboard.press('Tab');
  await expect(card.getByRole('link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card).toBeHidden();

  await label.focus();
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(label).toBeFocused();
  // The card was open, so that Escape left X-ray on; the next one leaves it, focus on the toggle.
  expect(await xrayOn(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle(page)).toBeFocused();
});

test('the HUD reports this visit and the build in numbers', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('x');
  const panel = hud(page);
  // It starts folded: a bar with the visit's vitals, from tablets up.
  const stats = panel.getByRole('button', { name: 'Stats' });
  await expect(stats).toHaveAttribute('aria-expanded', 'false');
  if (!isMobile) await expect(panel.getByRole('term').filter({ hasText: 'LCP' })).toBeVisible();
  const box = await panel.boundingBox();
  expect(box!.height).toBeLessThan(isMobile ? 64 : 48);
  await stats.click();
  await expect(stats).toHaveAttribute('aria-expanded', 'true');

  const value = (term: string) =>
    panel.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
  await expect(value('FCP')).toHaveText(/^\d+\.\d\d s/);
  await expect(value('CLS')).toHaveText(/^(< )?\d/);
  // The X just pressed is an interaction.
  await expect(value('INP')).toHaveText(/^\d+ ms/);
  // The page's own downloads, with X-ray's (and anything after it) apart.
  await expect(value('JavaScript')).toHaveText(/^\d+ KB\d+ files.* · \+\d+ KB since X.ray/);
  await expect(value('Requests')).toHaveText(/^\d+\+\d+ since X.ray/);
  // No input before X-ray but the X: the LCP is final.
  await expect(value('LCP')).not.toContainText('provisional');
  await expect(value('DOM elements')).toHaveText(/^\d[\d,]*/);
  await expect(value('Components')).toHaveText(/^\d+ client\d+ server · \d+ CSS only/);
  await expect(value('Lighthouse')).toHaveText(/^\d+ · \d+ · \d+ · \d+/);
  await expect(value('Tests')).toHaveText(/^[\d,]+ unit[\d,]+ end-to-end/);
  await expect(value('React')).toHaveText(/^19\.\d+\.\d+Next\.js 16\.\d+\.\d+/);

  // Opened, it stays open for the rest of the visit.
  await page.reload();
  await hydrated(page);
  await expect(hud(page).getByRole('button', { name: 'Stats' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('X-ray follows the page while it moves, then does no work while it is still', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const frames = { count: 0 };
    Object.assign(window, { frames });
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      frames.count += 1;
      return request(callback);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  const frames = () =>
    page.evaluate(() => (window as unknown as { frames: { count: number } }).frames.count);
  // Once the page settles, a second passes with next to no frames requested (60 if it polled).
  await page.waitForTimeout(1500);
  const before = await frames();
  await page.waitForTimeout(1000);
  expect((await frames()) - before).toBeLessThan(10);

  // Scrolling wakes it: the labels move with the page.
  await page.mouse.wheel(0, 900);
  await expect.poll(frames).toBeGreaterThan(before + 1);
});

test('reduced motion switches at once; otherwise the page peels in a typed view transition', async ({
  page,
}) => {
  const transitions = await countTransitions(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  await page.keyboard.press('x');
  await expect(hud(page)).toBeHidden();
  expect(await transitions()).toEqual([]);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  await page.keyboard.press('x');
  await expect(hud(page)).toBeHidden();
  expect(await transitions()).toEqual([
    ['xray', 'xray-lift'],
    ['xray', 'xray-lay'],
  ]);
  // The flap and its shadow exist only for the transition.
  await expect(page.locator('[data-xray-peel]')).toHaveCount(0);

  // A press during the peel waits for it, rather than being lost.
  await page.keyboard.press('x');
  await page.keyboard.press('x');
  await expect.poll(transitions).toHaveLength(4);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(await xrayOn(page)).toBe(false);
});

test('turning X-ray off restores the page as it was', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  const look = () =>
    page.evaluate(() => ({
      className: document.documentElement.className,
      body: getComputedStyle(document.body).backgroundColor,
      heading: getComputedStyle(document.querySelector('h1')!).color,
      outline: getComputedStyle(document.querySelector('[data-component="hero"]')!).outlineStyle,
    }));
  const before = await look();

  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  // Under reduced motion every property still changes over a 0.01 ms transition: a frame.
  await expect.poll(async () => (await look()).body).not.toBe(before.body);

  await hud(page).getByRole('button', { name: 'Exit' }).click();
  await expect(hud(page)).toBeHidden();
  await expect(labels(page)).toBeHidden();
  await expect.poll(look).toEqual(before);
  expect(await xrayOn(page)).toBe(false);
  await expect(toggle(page)).toBeFocused();
});

test('any button marked data-xray-toggle turns it on, and ?xray opens it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.dataset.xrayToggle = '';
    button.textContent = 'Peel it back';
    // Like the one How I built this renders in its content.
    document.querySelector('#contact')?.append(button);
  });
  await page.getByRole('button', { name: 'Peel it back' }).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/?xray');
  await expect(hud(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  // Turned off, ?xray leaves the address, so a reload doesn't bring it back.
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await hydrated(page);
  expect(await xrayOn(page)).toBe(false);
});

test('?xray=0 keeps it off, and a full page load in the same tab keeps it on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?xray=0');
  await hydrated(page);
  expect(await xrayOn(page)).toBe(false);

  await page.keyboard.press('x');
  await expect(hud(page)).toBeVisible();
  // The header's section links load the home page afresh from a case study.
  await page.goto('/work/mcp');
  await expect(hud(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('x');
  await expect(hud(page)).toBeHidden();
  await page.goto('/');
  await hydrated(page);
  expect(await xrayOn(page)).toBe(false);
});

test('X-ray’s code loads only on intent', async ({ page, isMobile }) => {
  // Strings only X-ray's own chunk and stylesheet contain.
  const markers = ['This visit, measured in your browser', '--xr-paper'];
  const bodies: Promise<string>[] = [];
  page.on('response', (response) => {
    const type = response.request().resourceType();
    if (type === 'script' || type === 'stylesheet') bodies.push(response.text());
  });
  const loaded = async () => {
    const all = await Promise.all(bodies);
    return markers.map((marker) => all.some((body) => body.includes(marker)));
  };

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve)));
  }
  await page.waitForLoadState('networkidle');
  expect(await loaded(), 'X-ray requested before any intent').toEqual([false, false]);

  if (isMobile) await page.keyboard.press('x');
  // Pointing at the toggle is intent enough: the code downloads before the press.
  else await toggle(page).hover();
  await expect.poll(loaded).toEqual([true, true]);
});

test('labels open their details with a tap, and the HUD is a sheet on phones', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Phones only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await toggle(page).tap();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  const stats = hud(page).getByRole('button', { name: 'Stats' });
  await expect(stats).toHaveAttribute('aria-expanded', 'false');
  await stats.tap();
  await expect(hud(page).locator('dt', { hasText: 'LCP' })).toBeVisible();
  await stats.tap();

  const label = labelFor(page, 'HeroAskBar');
  await label.tap();
  const card = page.getByRole('group', { name: 'HeroAskBar', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toBeInViewport();
  // A tap elsewhere puts it away.
  await page.locator('h1').tap();
  await expect(card).toBeHidden();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`X-ray has no serious or critical axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await page.keyboard.press('x');
    await expect(hud(page)).toBeVisible();
    // Colours change over a transition (a frame long under reduced motion): measure them after.
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);

    // With a card open, too.
    await labelFor(page, 'Hero').focus();
    await expect(page.getByRole('group', { name: 'Hero', exact: true })).toBeVisible();
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
  });
}

const ear = (page: Page) => page.locator('[data-xray-ear]');

/**
 * Pulls the page's corner from the dog-ear to `to` (a share of the viewport), by mouse or, on
 * phones, by touch (through the DevTools protocol, which Playwright's touchscreen lacks), in small
 * steps as a hand would. `end` lets go, cancels the pointer, or holds on.
 */
async function pull(
  page: Page,
  isMobile: boolean,
  to: readonly [number, number],
  end: 'release' | 'cancel' | 'hold' = 'release',
) {
  const { width, height } = page.viewportSize()!;
  const box = (await ear(page).boundingBox())!;
  const from = [box.x + box.width - 5, box.y + 5] as const;
  const target = [to[0] * width, to[1] * height] as const;
  const steps = 16;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
      });
    await touch('touchStart', ...from);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', ...lerp(from, target, i / steps));
      await page.waitForTimeout(30);
    }
    if (end === 'release') await touch('touchEnd');
    if (end === 'cancel') await touch('touchCancel');
    return;
  }
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(...lerp(from, target, i / steps));
    await page.waitForTimeout(30);
  }
  if (end === 'release') await page.mouse.up();
  if (end === 'cancel') await page.keyboard.press('Escape');
}

const lerp = (a: readonly [number, number], b: readonly [number, number], t: number) =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const;

/** Waits until no view transition is left on screen. */
const transitionOver = (page: Page) =>
  expect(page.locator('[data-xray-peel]')).toHaveCount(0, { timeout: 10_000 });

test.describe('the dog-ear', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await hydrated(page);
  });

  test('pulled far enough, it peels the page into X-ray', async ({ page, isMobile }) => {
    await expect(ear(page)).toBeVisible();
    await expect(ear(page)).toHaveAttribute('aria-hidden', 'true');
    await pull(page, isMobile, [0.15, 0.7]);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await xrayOn(page)).toBe(true);
    await transitionOver(page);
    await expect(hud(page)).toBeVisible();
    // In X-ray the corner has been turned already.
    await expect(ear(page)).toBeHidden();
  });

  test('pulled a little and let go, it springs back and nothing changes', async ({
    page,
    isMobile,
  }) => {
    await pull(page, isMobile, [0.85, 0.15]);
    await transitionOver(page);
    expect(await xrayOn(page)).toBe(false);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(hud(page)).toBeHidden();
    await expect(ear(page)).toBeVisible();
  });

  test('a cancelled pointer, or Escape, springs it back from anywhere', async ({
    page,
    isMobile,
  }) => {
    await pull(page, isMobile, [0.3, 0.6], 'cancel');
    await transitionOver(page);
    expect(await xrayOn(page)).toBe(false);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('the toggle still works afterwards, and lays the page back down', async ({
    page,
    isMobile,
  }) => {
    await pull(page, isMobile, [0.85, 0.15]);
    await transitionOver(page);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await transitionOver(page);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await transitionOver(page);
    expect(await xrayOn(page)).toBe(false);
  });

  test('a click on it, then moving away, leaves the page as it was', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a mouse click and a pointer that keeps moving');
    const box = (await ear(page).boundingBox())!;
    await page.mouse.move(box.x + box.width - 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.up();
    // The hand moves on at once, while the corner is still settling.
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(box.x - i * 40, box.y + i * 30);
      await page.waitForTimeout(20);
    }
    await transitionOver(page);
    expect(await xrayOn(page)).toBe(false);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await transitionOver(page);
  });

  test('moves after letting go never take the corner back', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a mouse that keeps moving after the button is up');
    await pull(page, isMobile, [0.85, 0.2]);
    const { width, height } = page.viewportSize()!;
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(width * (0.8 - i * 0.05), height * (0.2 + i * 0.05));
      await page.waitForTimeout(20);
    }
    await transitionOver(page);
    expect(await xrayOn(page)).toBe(false);
    await expect(ear(page)).toBeVisible();
  });

  test('takes no focus and stays out of the keyboard’s way', async ({ page }) => {
    const focusable = await ear(page).evaluate(
      (element) =>
        element.matches(':focus, [tabindex]') ||
        element.querySelector('[tabindex], a, button') !== null,
    );
    expect(focusable).toBe(false);
  });
});

test('there is no dog-ear under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await hydrated(page);
  await expect(ear(page)).toBeHidden();
});

test('pointing at the dog-ear is intent enough to load X-ray', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have no hover');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const bodies: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') bodies.push(response.text());
  });
  const loaded = async () =>
    (await Promise.all(bodies)).some((body) => body.includes('This visit, measured'));
  await page.goto('/');
  await hydrated(page);
  await page.waitForLoadState('networkidle');
  expect(await loaded()).toBe(false);
  await ear(page).hover();
  await expect.poll(loaded).toBe(true);
});
