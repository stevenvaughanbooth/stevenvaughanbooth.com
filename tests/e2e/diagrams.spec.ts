import { expect, type Page, test } from '@playwright/test';
import { TOUR_DWELL_MS } from '@/components/visuals/shared/tour/wording';
import { axeViolations, hydrated } from './helpers';

/** The three Work diagrams, which all play the same tour. */
const tours = [
  {
    theme: 'devtools',
    tablist: 'Stages of the multiplier loop',
    first: 'Discover',
    next: 'Share',
    last: 'Learn',
    // Steps between the first tab and the next.
    steps: 1,
  },
  {
    theme: 'mcp',
    tablist: 'Steps of progressive disclosure',
    first: 'Describe',
    next: 'Search',
    last: 'Query',
    steps: 1,
  },
  {
    theme: 'platform',
    tablist: 'Platform stories',
    first: 'Agent context',
    next: 'Schema Evolution',
    last: 'Metadata migration',
    // A story is three phases.
    steps: 3,
  },
] as const;

/**
 * Runs the page's clock over `steps` of a tour, one dwell at a time: each step's timer is set
 * once React has rendered the last, which needs the event loop between runs.
 */
async function advance(page: Page, steps: number) {
  for (let i = 0; i < steps; i++) await page.clock.runFor(TOUR_DWELL_MS + 200);
}

/** Puts a theme's tabs and panel on screen, where its tour counts down. */
async function showTour(page: Page, theme: string, tablist: string) {
  const card = page.locator(`#work-${theme}`);
  const tabs = card.getByRole('tablist', { name: tablist });
  await tabs.evaluate((element) =>
    scrollTo(0, element.getBoundingClientRect().top + scrollY - 120),
  );
  return { card, tabs, selected: tabs.locator('[aria-selected="true"]') };
}

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

test.describe('the diagrams’ shared tour', () => {
  for (const tour of tours) {
    test(`${tour.theme} tours by itself in view, holds on hover and focus, and pauses from its control`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.clock.install();
      await page.goto('/');
      await hydrated(page);
      const { card, tabs, selected } = await showTour(page, tour.theme, tour.tablist);

      const pause = card.getByRole('button', { name: 'Pause auto-advance' });
      await expect(pause).toBeVisible();
      await expect(selected).toContainText(tour.first);
      const status = card.getByText(/^(Auto-advancing|Paused while you look|Paused)$/);
      await expect(status).toHaveText('Auto-advancing');
      await advance(page, tour.steps);
      await expect(selected).toContainText(tour.next);

      // A mouse over the tabs holds it, however long it stays.
      await tabs.hover();
      await expect(status).toHaveText('Paused while you look');
      await advance(page, tour.steps * 2);
      await expect(selected).toContainText(tour.next);
      await page.mouse.move(0, 0);
      await expect(status).toHaveText('Auto-advancing');

      // So does focus in the panel.
      const panel = card.getByRole('tabpanel');
      await panel.focus();
      await expect(status).toHaveText('Paused while you look');
      await advance(page, tour.steps * 2);
      await expect(selected).toContainText(tour.next);
      await panel.blur();

      // The control pauses it for good, and plays it again.
      await pause.click();
      await expect(status).toHaveText('Paused');
      await advance(page, tour.steps * 2);
      await expect(selected).toContainText(tour.next);
      await card.getByRole('button', { name: 'Play auto-advance' }).click();
      // Reaching the footer can scroll a tall card's tabs away, which holds the tour: come back,
      // with the mouse out of the way.
      await showTour(page, tour.theme, tour.tablist);
      await page.mouse.move(0, 0);
      await expect(status).toHaveText('Auto-advancing');
    });
  }

  test('no diagram tours by itself under reduced motion, and tabs still jump', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/');
    await hydrated(page);
    for (const tour of tours) {
      const { card, selected } = await showTour(page, tour.theme, tour.tablist);
      await expect(selected).toContainText(tour.last);
      await expect(card.getByRole('button', { name: /auto-advance$/ })).toBeHidden();
      await advance(page, tour.steps * 2);
      await expect(selected).toContainText(tour.last);

      // The controller swaps in as the card nears view; then a tab jumps.
      const first = card.getByRole('tab', { name: tour.first });
      await expect(async () => {
        await first.click();
        await expect(first).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
      }).toPass();
    }
  });

  test('the Adage replay uses the same control and states', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await hydrated(page);
    const card = page.locator('[data-component="reflex-demo"]');
    // Just below the fold, its controller loads and resets the terminal out of sight; then it plays
    // as it scrolls in.
    await card.evaluate((element) =>
      scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight - 50),
    );
    await expect(card.getByText('Ready')).toBeAttached();
    await card.evaluate((element) => scrollTo(0, element.getBoundingClientRect().top + scrollY));
    const pause = card.getByRole('button', { name: 'Pause the session' });
    await expect(pause).toBeVisible();
    await expect(card.getByText('Replaying')).toBeVisible();
    await pause.click();
    await expect(card.getByText(/^Paused$/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Play the session' })).toBeFocused();
  });
});

test.describe('the MCP diagram in 3D', () => {
  test('draws its scene over the graph once the page has settled, without moving the page', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/work/mcp');
    await hydrated(page);
    const stage = page.getByRole('img', { name: /^(Describe|Search|Query):/ });
    const height = () => stage.evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(height).toBeGreaterThan(0);
    const before = await height();
    const scene = stage.locator('[data-scene="live"]');
    await expect(scene).toBeVisible({ timeout: 30_000 });
    await expect(scene).toHaveAttribute('aria-hidden', 'true');
    await expect(scene.locator('canvas')).toHaveCount(1);
    expect(await height()).toBe(before);

    // Real pixels: the stage looks different with the canvas than without it. The graph beneath
    // is faded out while the scene is live, so without the canvas only the stage's grid is left.
    await expect
      .poll(() => scene.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
    const drawn = await stage.screenshot();
    await scene.evaluate((element) => (element.style.visibility = 'hidden'));
    const empty = await stage.screenshot();
    expect(drawn.equals(empty)).toBe(false);
    expect(drawn.length).toBeGreaterThan(empty.length);
  });

  test('keeps the 2D graph, and never fetches three.js, where WebGL is unavailable', async ({
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
    await page.goto('/work/mcp');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const stage = page.getByRole('img', { name: /^(Describe|Search|Query):/ });
    expect(three()).toBe(false);
    await expect(stage.locator('canvas')).toHaveCount(0);
    await expect(stage.locator('[data-scene="live"]')).toHaveCount(0);
    const graph = stage.locator('svg');
    await expect(graph).toBeVisible();
    expect(
      await graph.evaluate((element) => getComputedStyle(element.parentElement!).opacity),
    ).toBe('1');
  });

  test('three.js is not fetched on the home page until a diagram nears the viewport', async ({
    page,
  }) => {
    const three = watchThree(page);
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(three()).toBe(false);

    await page.locator('#work-mcp').scrollIntoViewIfNeeded();
    await expect.poll(three, { timeout: 30_000 }).toBe(true);
    await expect(page.locator('#work-mcp [data-scene="live"]')).toBeVisible({ timeout: 30_000 });
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/work/mcp with its scene live in ${colorScheme} has no serious or critical axe violations`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/work/mcp');
      await expect(page.locator('[data-scene="live"]')).toBeVisible({ timeout: 30_000 });
      expect(await axeViolations(page)).toEqual([]);
      // No CSP report or WebGL error on the way.
      expect(errors).toEqual([]);
    });
  }
});
