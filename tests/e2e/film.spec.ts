import { expect, test, type Request } from '@playwright/test';
import { hydrated } from './helpers';

// The film is 9 MB. Nothing but an explicit Play may fetch it.
const isFilmVideo = (request: Request) =>
  /^\/film\/.+\.(mp4|webm)$/.test(new URL(request.url()).pathname);

test('requests no video before Play, even with the film on screen', async ({ page }) => {
  const videoRequests: string[] = [];
  page.on('request', (request) => {
    if (isFilmVideo(request)) videoRequests.push(request.url());
  });

  await page.goto('/');
  await page.locator('#film').scrollIntoViewIfNeeded();
  await expect(page.locator('#film')).toBeInViewport();
  await page.waitForLoadState('networkidle');

  expect(videoRequests).toEqual([]);
});

test('Play starts downloading the film', async ({ page }) => {
  await page.goto('/');
  const film = page.locator('#film');
  await film.scrollIntoViewIfNeeded();

  const videoRequest = page.waitForRequest(isFilmVideo);
  await film.getByRole('button', { name: /play/i }).click();
  await videoRequest;
});

test('"Scene by scene" is a modal dialog that keeps focus and returns it', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const trigger = page.locator('#film').getByRole('button', { name: 'Scene by scene' });
  const dialog = page.getByRole('dialog', { name: 'Scene by scene' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

  // The page behind is inert: Tab never reaches it (it may leave for the browser's own UI).
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const escaped = await page.evaluate(
      () => document.activeElement !== document.body && !document.activeElement?.closest('dialog'),
    );
    expect(escaped, `focus left the dialog after ${i + 1} Tab presses`).toBe(false);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
