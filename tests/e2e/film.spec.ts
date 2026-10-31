import { expect, type Page, test } from '@playwright/test';
import { film } from '@/content/profile';
import { axeViolations, hydrated } from './helpers';

/*
 * Arrival opens the hero. From md the frame plays a 4:5 cut once, after the page has loaded and
 * gone idle; the chip replays the full 16:9 film in a theater. Below md, under reduced motion
 * and with Save-Data, nothing plays until the visitor asks.
 */

const filmRequest = (url: string) => /\/film\/arrival-[\w-]+\.[0-9a-f]{8}\.mp4$/.test(url);
const frameCut = (url: string) => /\/film\/arrival-frame-/.test(url);

const chip = (page: Page) =>
  page.getByRole('button', { name: `Play ${film.title} · 0:16, a 16-second film` });
const theater = (page: Page) => page.getByRole('dialog', { name: film.title });
const frameVideo = (page: Page) => page.locator('#film video');

/** Records every film request the page makes. */
function recordFilmRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (filmRequest(request.url())) requests.push(new URL(request.url()).pathname);
  });
  return requests;
}

/** Lets the page load, go idle and reach network idle, so a film that would start has started. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    () => new Promise((resolve) => requestIdleCallback(() => setTimeout(resolve, 300))),
  );
}

test.describe('in the hero’s frame', () => {
  test('plays nothing by itself on a small screen, where the portrait is an avatar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const requests = recordFilmRequests(page);
    await page.goto('/');
    await settle(page);
    await expect(chip(page)).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('plays nothing by itself under reduced motion or with Save-Data', async ({ page }) => {
    const requests = recordFilmRequests(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'connection', { value: { saveData: true } }),
    );
    await page.reload();
    await settle(page);

    expect(requests).toEqual([]);
    await expect(frameVideo(page)).toHaveCount(0);
  });

  test('paints the portrait first and starts the 4:5 cut only after load', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'The frame plays from md up.');
    // Media has no resource timing, so note when the page first gives a video its source.
    await page.addInitScript(() => {
      const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        ...src,
        set(value: string) {
          const marks = performance.getEntriesByName('film-src');
          if (marks.length === 0) performance.mark('film-src', { detail: value });
          src.set!.call(this, value);
        },
      });
    });
    await page.goto('/');
    await expect(frameVideo(page)).toHaveAttribute('data-shown', '');

    const timing = await page.evaluate(async () => {
      const lcp = await new Promise<LargestContentfulPaint | undefined>((resolve) =>
        new PerformanceObserver((list) =>
          resolve(list.getEntries().at(-1) as LargestContentfulPaint),
        ).observe({ type: 'largest-contentful-paint', buffered: true }),
      );
      const [navigation] = performance.getEntriesByType(
        'navigation',
      ) as PerformanceNavigationTiming[];
      const [source] = performance.getEntriesByName('film-src') as PerformanceMark[];
      return {
        lcp: lcp?.element?.getAttribute('alt'),
        lcpTime: lcp?.startTime ?? Infinity,
        load: navigation?.loadEventEnd ?? Infinity,
        film: source?.startTime ?? -1,
        url: String(source?.detail ?? ''),
      };
    });
    expect(timing.lcp).toBe('Portrait of Steven Booth');
    expect(frameCut(timing.url)).toBe(true);
    expect(timing.film).toBeGreaterThan(timing.lcpTime);
    expect(timing.film).toBeGreaterThanOrEqual(timing.load);
  });

  test('can be paused, lands on the portrait, and plays once a visit', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'The frame plays from md up.');
    await page.goto('/');
    const video = frameVideo(page);
    await expect(video).toHaveAttribute('data-shown', '');

    await page.getByRole('button', { name: 'Pause film' }).click();
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await page.getByRole('button', { name: 'Resume film' }).click();
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);

    // Skip to the last moment: the film fades out and leaves the portrait.
    await video.evaluate((element: HTMLVideoElement) => {
      element.currentTime = element.duration - 0.1;
    });
    await expect(video).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByRole('img', { name: 'Portrait of Steven Booth' })).toBeVisible();

    const requests = recordFilmRequests(page);
    await page.reload();
    await settle(page);
    expect(requests).toEqual([]);
  });

  test('its chip shows Expand, not Play, while the film plays in the frame', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'The frame plays from md up.');
    const [play, expand] = [chip(page).locator('svg').first(), chip(page).locator('svg').nth(1)];
    // At rest (here under reduced motion, so the film stays out of the frame) the chip says Play.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page);
    await expect(play).toBeVisible();
    await expect(expand).toBeHidden();

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await expect(frameVideo(page)).toHaveAttribute('data-shown', '');
    await expect(play).toBeHidden();
    await expect(expand).toBeVisible();

    // Paused, the frame's own control is the only Play on the frame.
    await page.getByRole('button', { name: 'Pause film' }).click();
    await expect(page.getByRole('button', { name: 'Resume film' })).toBeVisible();
    await expect(play).toBeHidden();
    await expect(expand).toBeVisible();
    await expect(chip(page)).toHaveAccessibleName(`Play ${film.title} · 0:16, a 16-second film`);
  });

  test('old /#film links land on the frame', async ({ page }) => {
    await page.goto('/#film');
    await expect(page.locator('#film')).toBeInViewport();
  });
});

test.describe('in the theater', () => {
  test('opens from the chip as a modal dialog that keeps focus and returns it', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests = recordFilmRequests(page);
    await page.goto('/');
    await hydrated(page);
    await chip(page).focus();
    await page.keyboard.press('Enter');

    const dialog = theater(page);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Pause film' })).toBeFocused();
    await expect.poll(() => requests).toContainEqual(expect.stringMatching(/arrival-(av1|h264)\./));

    // The page behind is inert: Tab never reaches it (it may leave for the browser's own UI).
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const escaped = await page.evaluate(
        () =>
          document.activeElement !== document.body && !document.activeElement?.closest('dialog'),
      );
      expect(escaped, `focus left the theater after ${i + 1} Tab presses`).toBe(false);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(chip(page)).toBeFocused();
    await expect(dialog.locator('video')).toHaveCount(0);
  });

  test('morphs the frame into the theater with a view transition, and back', async ({ page }) => {
    await page.goto('/');
    await hydrated(page);
    // Count the view transitions React starts, and check the frame is the one that moves.
    await page.evaluate(() => {
      const root = document.documentElement;
      const start = document.startViewTransition.bind(document);
      root.dataset.morphs = '';
      document.startViewTransition = ((update: StartViewTransitionOptions) => {
        const transition = start(update);
        void transition.ready.then(() => {
          const names = root
            .getAnimations({ subtree: true })
            .map((animation) => (animation.effect as KeyframeEffect).pseudoElement ?? '');
          if (names.some((name) => name.startsWith('::view-transition-group(arrival-film)'))) {
            root.dataset.morphs += 'm';
          }
        });
        return transition;
      }) as typeof document.startViewTransition;
    });

    await chip(page).click();
    await expect(theater(page)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-morphs', 'm');
    await page.keyboard.press('Escape');
    await expect(theater(page)).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-morphs', 'mm');
    await expect(chip(page)).toBeFocused();
  });

  test('"Scene by scene" opens over it, and Escape closes only the scenes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await chip(page).click();
    const dialog = theater(page);
    await expect(dialog).toBeVisible();

    const trigger = dialog.getByRole('button', { name: 'Scene by scene' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const scenes = page.getByRole('dialog', { name: 'Scene by scene' });
    await expect(scenes).toBeVisible();
    expect(await scenes.evaluate((element) => element.matches(':modal'))).toBe(true);
    await expect(scenes.getByRole('button', { name: 'Close' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(scenes).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('still opens, explains and offers the scenes if the player can’t load', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    // Every chunk from here on fails, as when the network drops before the first press.
    await page.route('**/_next/static/chunks/**', (route) => route.abort());
    await chip(page).click();

    const dialog = theater(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toHaveText(/The film couldn’t load\./);
    await expect(dialog.locator('video')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Scene by scene' }).click();
    const scenes = page.getByRole('dialog', { name: 'Scene by scene' });
    await expect(scenes).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(scenes).toBeHidden();

    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toBeHidden();
    await expect(chip(page)).toBeFocused();
  });

  test('loads its end plate’s styles with the player', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await chip(page).click();
    const dialog = theater(page);
    await expect(dialog).toBeVisible();
    // Skip to the end of the film.
    const video = dialog.locator('video');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(0);
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = v.duration;
    });
    const plate = dialog.getByRole('button', { name: 'Continue to the site' });
    await expect(plate).toBeVisible();
    // The plate sits on the monitor glass: positioned by player.module.css, which arrives on intent.
    const position = await plate.evaluate(
      (button) => getComputedStyle(button.closest('[class*="screen"]')!).position,
    );
    expect(position).toBe('absolute');
    await plate.click();
    await expect(dialog).toBeHidden();
    await expect(chip(page)).toBeFocused();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no serious or critical axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await hydrated(page);
      await chip(page).click();
      await expect(theater(page)).toBeVisible();
      expect(await axeViolations(page, (axe) => axe.include('dialog[open]'))).toEqual([]);
    });
  }
});
