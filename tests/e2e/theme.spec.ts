import { expect, type Page, test } from '@playwright/test';
import { themeToggle as toggle } from './helpers';

declare global {
  interface Window {
    __firstFrameTheme?: string;
  }
}

/** The theme the document had at its first animation frame, which runs before first paint. */
async function themeAtFirstFrame(page: Page) {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      window.__firstFrameTheme = document.documentElement.dataset.theme ?? 'system';
    });
  });
  await page.reload();
  await page.waitForFunction(() => window.__firstFrameTheme !== undefined);
  return page.evaluate(() => window.__firstFrameTheme);
}

test('follows the system preference until the visitor chooses', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'dark',
  );
});

test('the toggle switches theme and the choice persists across reloads without a flash', async ({
  page,
}) => {
  // A light system preference means a dark first frame can only come from the saved choice.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');

  await toggle(page).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

  expect(await themeAtFirstFrame(page)).toBe('dark');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await toggle(page).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await themeAtFirstFrame(page)).toBe('light');
});

for (const system of ['light', 'dark'] as const) {
  test(`the toggle reports whether dark mode is on (system ${system})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.goto('/');
    const button = toggle(page);
    const dark = system === 'dark';

    // Unknown on the server, so the pressed state appears with hydration and follows the system.
    await expect(button).toHaveAttribute('aria-pressed', String(dark));
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', String(!dark));
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', String(dark));
  });
}
