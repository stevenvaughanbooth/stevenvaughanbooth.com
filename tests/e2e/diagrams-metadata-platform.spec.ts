import { expect, type Locator, type Page, test } from '@playwright/test';
import { axeViolations, hydrated, themeToggle } from './helpers';

/*
 * The Core Metadata Platform diagram in 3D (Work theme 03, and the head of /work/platform): one
 * scene for all three stories, over the server-rendered diagrams that stay the content.
 */

const card = (page: Page) => page.locator('[data-component="metadata-platform"]').first();
const stage = (page: Page) => card(page).getByRole('img');
const live = (page: Page) => stage(page).locator('[data-scene="live"]');

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

/** The stage's mean brightness on screen, 0 to 1, from a screenshot drawn into a canvas. */
async function brightness(page: Page, target: Locator) {
  const png = (await target.screenshot()).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i]! + pixels[i + 1]! + pixels[i + 2]!;
    return sum / (pixels.length / 4) / 765;
  }, png);
}

test.describe('the platform diagram in 3D', () => {
  test('draws its stories over the 2D diagrams once the page has settled, without moving the page', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/platform');
    await hydrated(page);
    const height = () => stage(page).evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(height).toBeGreaterThan(0);
    const before = await height();
    await expect(live(page)).toBeVisible({ timeout: 30_000 });
    await expect(live(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(live(page).locator('canvas')).toHaveCount(1);
    expect(await height()).toBe(before);

    // Real pixels: with the 2D diagram faded out beneath, hiding the canvas leaves only the grid.
    await expect
      .poll(() => live(page).evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
    const drawn = await stage(page).screenshot();
    await live(page).evaluate((element) => (element.style.visibility = 'hidden'));
    const empty = await stage(page).screenshot();
    expect(drawn.equals(empty)).toBe(false);
    expect(drawn.length).toBeGreaterThan(empty.length);
  });

  test('keeps one scene across stories: a story moves the camera, not the canvas', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/platform');
    await expect(live(page)).toBeVisible({ timeout: 30_000 });
    const canvas = live(page).locator('canvas');
    await canvas.evaluate((element) => (element.dataset.kept = 'yes'));
    const migration = await stage(page).screenshot();

    // Under reduced motion each story cuts to its own framing.
    await card(page).getByRole('tab', { name: 'Agent context' }).click();
    await expect(stage(page)).toHaveAccessibleName(/^Illustrative metadata from Salesforce Core/);
    await expect.poll(async () => (await stage(page).screenshot()).equals(migration)).toBe(false);
    await expect(live(page).locator('canvas[data-kept="yes"]')).toHaveCount(1);

    // So does a phase within a story.
    const outcome = await stage(page).screenshot();
    await card(page)
      .getByRole('list', { name: 'Phases of this story' })
      .getByRole('button', { name: 'Extract' })
      .click();
    await expect.poll(async () => (await stage(page).screenshot()).equals(outcome)).toBe(false);
    await expect(live(page).locator('canvas[data-kept="yes"]')).toHaveCount(1);
  });

  test('recolours the scene when the theme switches', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/work/platform');
    await hydrated(page);
    await expect(live(page)).toBeVisible({ timeout: 30_000 });
    expect(await brightness(page, stage(page))).toBeLessThan(0.3);
    await themeToggle(page).click();
    // The platform and its plates turn light with the page, not just the page around them.
    await expect.poll(() => brightness(page, stage(page))).toBeGreaterThan(0.85);
    await expect(live(page)).toBeVisible();
  });

  test('keeps the 2D diagrams, and never fetches three.js, where WebGL is unavailable', async ({
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
    await page.goto('/work/platform');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    expect(three()).toBe(false);
    await expect(stage(page).locator('canvas')).toHaveCount(0);
    await expect(live(page)).toHaveCount(0);
    const diagram = stage(page).locator('svg');
    await expect(diagram).toBeVisible();
    expect(
      await diagram.evaluate(
        (element) => getComputedStyle(element.closest('[data-phase]')!.parentElement!).opacity,
      ),
    ).toBe('1');
  });

  test('loads its scene on the home page only as the card nears the viewport', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(three()).toBe(false);

    await page.locator('#work-platform').scrollIntoViewIfNeeded();
    await expect.poll(three, { timeout: 30_000 }).toBe(true);
    await expect(page.locator('#work-platform [data-scene="live"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/work/platform with its scene live in ${colorScheme} has no serious or critical axe violations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/work/platform');
      await expect(live(page)).toBeVisible({ timeout: 30_000 });
      expect(await axeViolations(page)).toEqual([]);
      // No CSP report or WebGL error on the way.
      expect(errors).toEqual([]);
    });
  }
});
