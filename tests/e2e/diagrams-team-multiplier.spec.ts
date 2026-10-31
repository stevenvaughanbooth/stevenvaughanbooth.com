import { expect, type Locator, type Page, test } from '@playwright/test';
import { axeViolations, hydrated, themeToggle } from './helpers';

/*
 * The multiplier loop in 3D: the scene over the server-rendered network on /work/devtools, where
 * the card heads the case study, and on the home page, where it waits below the fold.
 */

const stageName = /^(Discover|Share|Enable|Learn):/;

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
async function brightness(page: Page, stage: Locator) {
  const png = (await stage.screenshot()).toString('base64');
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

test.describe('the multiplier diagram in 3D', () => {
  test('draws its network over the SVG once the page has settled, without moving the page', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/devtools');
    await hydrated(page);
    const stage = page.getByRole('img', { name: stageName });
    const height = () => stage.evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(height).toBeGreaterThan(0);
    const before = await height();
    const scene = stage.locator('[data-scene="live"]');
    await expect(scene).toBeVisible({ timeout: 30_000 });
    await expect(scene).toHaveAttribute('aria-hidden', 'true');
    await expect(scene.locator('canvas')).toHaveCount(1);
    expect(await height()).toBe(before);

    // Real pixels: the stage looks different with the canvas than without it. The SVG beneath is
    // faded out while the scene is live, so without the canvas only the stage's grid is left.
    await expect
      .poll(() => scene.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
    const drawn = await stage.screenshot();
    await scene.evaluate((element) => (element.style.visibility = 'hidden'));
    const empty = await stage.screenshot();
    expect(drawn.equals(empty)).toBe(false);
    expect(drawn.length).toBeGreaterThan(empty.length);
  });

  test('draws each stage when its tab is picked, and takes drags itself', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/devtools');
    await hydrated(page);
    const stage = page.getByRole('img', { name: stageName });
    const scene = stage.locator('[data-scene="live"]');
    await expect(scene).toBeVisible({ timeout: 30_000 });

    // Under reduced motion each stage cuts in at once: every one is a different picture.
    const shots: Buffer[] = [];
    for (const name of ['Discover', 'Share', 'Enable', 'Learn']) {
      await page.getByRole('tab', { name }).click();
      await expect(stage).toHaveAccessibleName(new RegExp(`^${name}:`));
      await expect(scene).toBeVisible();
      // Let the frame after the cut land before comparing.
      await page.waitForTimeout(300);
      shots.push(await stage.screenshot());
    }
    for (let i = 1; i < shots.length; i++) expect(shots[i]!.equals(shots[i - 1]!)).toBe(false);

    // The faded SVG beneath never takes the pointer from the scene, so a drag orbits.
    const hit = await stage.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.tagName;
    });
    expect(hit).toBe('CANVAS');
  });

  test('recolours the scene when the theme switches', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/work/devtools');
    await hydrated(page);
    const stage = page.getByRole('img', { name: stageName });
    await expect(stage.locator('[data-scene="live"]')).toBeVisible({ timeout: 30_000 });

    expect(await brightness(page, stage)).toBeLessThan(0.3);
    await themeToggle(page).click();
    // The glass floor turns light with the page, not just the page around it.
    await expect.poll(() => brightness(page, stage)).toBeGreaterThan(0.85);
    await expect(stage.locator('[data-scene="live"]')).toBeVisible();
  });

  test('keeps the 2D network, and never fetches three.js, where WebGL is unavailable', async ({
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
    await page.goto('/work/devtools');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const stage = page.getByRole('img', { name: stageName });
    expect(three()).toBe(false);
    await expect(stage.locator('canvas')).toHaveCount(0);
    await expect(stage.locator('[data-scene="live"]')).toHaveCount(0);
    const network = stage.locator('svg');
    await expect(network).toBeVisible();
    expect(
      await network.evaluate((element) => getComputedStyle(element.parentElement!).opacity),
    ).toBe('1');
  });

  test('on the home page, three.js waits until the card nears the viewport', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(three()).toBe(false);

    await page.locator('#work-devtools').scrollIntoViewIfNeeded();
    await expect.poll(three, { timeout: 30_000 }).toBe(true);
    await expect(page.locator('#work-devtools [data-scene="live"]')).toBeVisible({
      timeout: 30_000,
    });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/work/devtools with its scene live in ${colorScheme} has no serious or critical axe violations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/work/devtools');
      await expect(page.locator('[data-scene="live"]')).toBeVisible({ timeout: 30_000 });
      expect(await axeViolations(page)).toEqual([]);
      // No CSP report or WebGL error on the way.
      expect(errors).toEqual([]);
    });
  }
});
