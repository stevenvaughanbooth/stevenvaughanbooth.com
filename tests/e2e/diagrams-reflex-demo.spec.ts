import { expect, type Page, test } from '@playwright/test';
import { adage } from '@/content/profile';
import { axeViolations, hydrated } from './helpers';

/** The Adage replay's card and its pipeline stage, where the 3D scene draws. */
const replay = (page: Page) => {
  const card = page.locator('[data-component="reflex-demo"]');
  return { card, stage: card.locator('[data-scene]').locator('..') };
};

/** Scrolls the card's top to just below the page header. */
const showCard = (page: Page) =>
  replay(page).card.evaluate((element) =>
    scrollTo(0, element.getBoundingClientRect().top + scrollY - 20),
  );

/** Whether a script that contains three.js has been fetched, read from response bodies. */
function watchThree(page: Page) {
  let fetched = false;
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    const body = await response.text().catch(() => '');
    if (body.includes('THREE.WebGLRenderer')) fetched = true;
  });
  return () => fetched;
}

/** The scene's caption lines and the loop label, by their phase. */
const phases = (page: Page) =>
  replay(page).card.evaluate((card) =>
    [...card.querySelectorAll<HTMLElement>('[data-scene] [data-phase]')].map(
      (element) => element.dataset.phase,
    ),
  );

test.describe('the Adage replay in 3D', () => {
  test('draws the pipeline in 3D once the page has settled, without moving the page', async ({
    page,
  }) => {
    const three = watchThree(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    // Below the fold, nothing of the scene loads with the page.
    expect(three()).toBe(false);

    await showCard(page);
    const { card, stage } = replay(page);
    const height = () => card.evaluate((element) => element.getBoundingClientRect().height);
    const before = await height();
    const scene = card.locator('[data-scene="live"]');
    await expect(scene).toBeVisible({ timeout: 30_000 });
    await expect.poll(three).toBe(true);
    await expect(scene).toHaveAttribute('aria-hidden', 'true');
    await expect(scene.locator('canvas')).toHaveCount(1);
    expect(await height()).toBe(before);

    // The pipeline stays the content: its list is still read, under the scene.
    const pipeline = card.getByRole('list', { name: 'From history to reuse' });
    await expect(pipeline.getByRole('listitem')).toContainText(adage.pipeline.map(String));
    // At rest, the scene shows the whole loop: every stage is captioned, the loop is lit.
    expect(await phases(page)).toEqual(['passed', 'passed', 'passed', 'passed', 'current']);
    for (const stageName of adage.pipeline) await expect(scene).toContainText(stageName);

    // Real pixels: the stage looks different with the canvas than without it.
    await expect
      .poll(() => scene.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
    const drawn = await stage.screenshot();
    await scene.locator('canvas').evaluate((element) => (element.style.visibility = 'hidden'));
    const empty = await stage.screenshot();
    expect(drawn.equals(empty)).toBe(false);
  });

  test('follows the replay from the history to the loop, and holds it while dragged', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await hydrated(page);
    const { card } = replay(page);
    // Just below the fold, the controller loads and resets the replay out of sight.
    await card.evaluate((element) =>
      scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight - 50),
    );
    await expect(card.getByText('Ready')).toBeAttached();
    await showCard(page);
    await page.mouse.move(0, 0);
    await expect(card.locator('[data-scene="live"]')).toBeVisible({ timeout: 30_000 });

    // Each stage of the pipeline is current in turn, and the session ends on the loop.
    const current = async () => (await phases(page)).indexOf('current');
    await expect.poll(current, { timeout: 30_000 }).toBeGreaterThanOrEqual(0);
    const seen = new Set<number>();
    await expect
      .poll(
        async () => {
          seen.add(await current());
          return seen.has(4);
        },
        { timeout: 60_000, intervals: [100] },
      )
      .toBe(true);
    expect([...seen].sort()).toEqual(expect.arrayContaining([2, 3, 4]));
    await expect(card.getByRole('button', { name: 'Replay the session' })).toBeVisible();

    // A press on the scene holds the replay, as on any tour.
    await card.getByRole('button', { name: 'Replay the session' }).click();
    // Reaching the footer can scroll the stage away, which holds the replay: come back.
    await showCard(page);
    const canvas = card.locator('[data-scene="live"] canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2);
    await expect(card.getByText('Paused while you look')).toBeVisible();
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await expect(card.getByText('Replaying')).toBeVisible();
  });

  test('plays while any good part of the stage and terminal is in view, and holds once it is not', async ({
    page,
  }, testInfo) => {
    const phone = testInfo.project.name === 'mobile';
    if (!phone) await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await hydrated(page);
    const { card } = replay(page);
    const terminal = card.getByRole('region', { name: 'Terminal' });
    const status = card.getByText(/^(Replaying|Paused while you look|Paused|Ready)$/);
    // Just below the fold, the controller loads and resets the replay out of sight.
    await card.evaluate((element) =>
      scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight - 50),
    );
    await expect(status).toHaveText('Ready');

    // Only the terminal in view on a phone, where it sits under the stage; on a wide screen, where
    // they sit side by side, only their lower half.
    await terminal.evaluate((element, phone) => {
      const band = element.parentElement!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const top = phone ? box.top : band.top + band.height / 2;
      scrollTo(0, top + scrollY - 70);
    }, phone);
    await page.mouse.move(0, 0);
    await expect(status).toHaveText('Replaying');
    const printed = () => terminal.evaluate((element) => (element as HTMLElement).innerText.length);
    const before = await printed();
    await expect.poll(printed).toBeGreaterThan(before);

    // Out of sight, it holds where it was, and says nothing new: nobody is looking at it.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(300);
    await expect(status).toHaveText('Replaying');
    const held = await printed();
    await page.waitForTimeout(1_500);
    expect(await printed()).toBe(held);
  });

  test('keeps the terminal to a fixed height that scrolls, resting on the end of the session', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await showCard(page);
    const { card } = replay(page);
    const terminal = card.getByRole('region', { name: 'Terminal' });
    // How far the console is scrolled up from its end, whether it is the static card's reversed
    // column or the controller's.
    const fromEnd = () =>
      terminal.evaluate((element) => {
        const max = element.scrollHeight - element.clientHeight;
        const reversed = getComputedStyle(element).flexDirection === 'column-reverse';
        return { max, up: Math.round(reversed ? -element.scrollTop : max - element.scrollTop) };
      });
    // The session is longer than the console: it shows the end, the match and the passing run.
    await expect.poll(async () => (await fromEnd()).max).toBeGreaterThan(0);
    expect((await fromEnd()).up).toBeLessThanOrEqual(1);
    await expect(terminal).toContainText('reflex matched');
    // Keyboard users reach it and scroll back through the session.
    await terminal.focus();
    await expect(terminal).toBeFocused();
    await page.keyboard.press('Home');
    await expect.poll(async () => (await fromEnd()).up).toBeGreaterThan(100);
    // The whole replay, stage and terminal, fits on one screen.
    const band = await terminal.evaluate((element) => {
      const { top, bottom } = element.parentElement!.getBoundingClientRect();
      return bottom - top;
    });
    expect(band).toBeLessThan(page.viewportSize()!.height - 80);
  });

  test('keeps the 2D pipeline, and never fetches three.js, where WebGL is unavailable', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type.startsWith('webgl')) return null;
        return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof getContext;
    });
    const three = watchThree(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await showCard(page);
    const { card } = replay(page);
    // The controller has swapped in: its footer control is live.
    await expect(card.getByText('Full session')).toBeAttached();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    expect(three()).toBe(false);
    await expect(card.locator('canvas')).toHaveCount(0);
    await expect(card.locator('[data-scene="live"]')).toHaveCount(0);
    const pipeline = card.getByRole('list', { name: 'From history to reuse' });
    await expect(pipeline).toBeVisible();
    expect(
      await pipeline.evaluate(
        (element) => getComputedStyle(element.parentElement!.parentElement!).opacity,
      ),
    ).toBe('1');
  });

  test('the Open source section never scrolls sideways at 320 px with the scene live', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the width is set here, not by the device');
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await showCard(page);
    await expect(replay(page).card.locator('[data-scene="live"]')).toBeVisible({
      timeout: 30_000,
    });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/ with the replay's scene live in ${colorScheme} has no serious or critical axe violations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await hydrated(page);
      await showCard(page);
      await expect(replay(page).card.locator('[data-scene="live"]')).toBeVisible({
        timeout: 30_000,
      });
      expect(await axeViolations(page)).toEqual([]);
      // No CSP report or WebGL error on the way.
      expect(errors).toEqual([]);
    });
  }
});
