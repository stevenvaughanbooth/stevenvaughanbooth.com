import { expect, type Page, test } from '@playwright/test';
import {
  askTrigger,
  axeViolations,
  focusIsWithin,
  hydrated,
  palette,
  themeToggle,
} from './helpers';

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });
const footerButton = (page: Page) =>
  page.getByRole('contentinfo').getByRole('button', { name: 'Keyboard shortcuts' });

test('? opens the shortcuts sheet, and Escape closes it and returns focus', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const trigger = askTrigger(page);
  await trigger.focus();

  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('heading', { name: 'Keyboard shortcuts' })).toBeFocused();
  await expect(sheet(page).getByRole('term')).toHaveText([
    'Ask Steven',
    'Type a question',
    'Switch theme',
    'Under the hood',
    'Show these shortcuts',
    'Close a dialog or menu',
  ]);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(trigger).toBeFocused();

  // ? toggles it, and the Close button closes it too.
  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeHidden();
  await page.keyboard.press('Shift+Slash');
  await sheet(page).getByRole('button', { name: 'Close' }).click();
  await expect(sheet(page)).toBeHidden();
});

test('a press outside the sheet closes it', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(sheet(page)).toBeHidden();
});

test('the sheet’s code loads only on intent', async ({ page, isMobile }) => {
  // A string only the sheet's own chunk contains.
  const marker = 'Single-key shortcuts';
  const scripts: Promise<string>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.push(response.text());
  });
  const sheetLoaded = async () =>
    (await Promise.all(scripts)).some((body) => body.includes(marker));

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve)));
  }
  await page.waitForLoadState('networkidle');
  expect(await sheetLoaded(), 'sheet code requested before any intent').toBe(false);

  if (isMobile) {
    await page.keyboard.press('Shift+Slash');
  } else {
    // Pointing at the footer's button is intent enough: the code downloads before the click.
    await footerButton(page).hover();
  }
  await expect.poll(sheetLoaded).toBe(true);
});

test('T switches the theme, and the choice persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await hydrated(page);
  const html = page.locator('html');

  await page.keyboard.press('t');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await hydrated(page);

  await page.keyboard.press('t');
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('single keys never fire while typing, even in the Ask palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
  await expect.poll(() => focusIsWithin(palette(page))).toBe(true);

  await page.keyboard.type('t?');
  await expect(palette(page).getByRole('combobox')).toHaveValue('t?');
  await expect(sheet(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
});

test('single-key shortcuts can be turned off, and the footer button still opens the sheet', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await hydrated(page);
  await page.keyboard.press('Shift+Slash');
  const toggle = sheet(page).getByRole('switch', { name: 'Single-key shortcuts' });
  await expect(toggle).toBeChecked();
  const xray = page.getByRole('banner').getByRole('button', { name: 'Under the hood' });
  await expect(xray).toHaveAttribute('aria-keyshortcuts', 'X');
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  // A key that does nothing is no longer announced.
  await expect(xray).not.toHaveAttribute('aria-keyshortcuts');
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();

  // Off for good: across a reload, neither ?, T nor X does anything.
  await page.reload();
  await hydrated(page);
  await expect(xray).not.toHaveAttribute('aria-keyshortcuts');
  await page.keyboard.press('Shift+Slash');
  await page.keyboard.press('t');
  await page.keyboard.press('x');
  await expect(sheet(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-xray'))).toBe(false);

  // The footer button shows from the sm breakpoint, where a keyboard is likely.
  if (isMobile) return;
  await footerButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole('switch', { name: 'Single-key shortcuts' }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Slash');
  await expect(sheet(page)).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the open sheet has no serious or critical axe violations (${colorScheme})`, async ({
    page,
  }) => {
    // Its opening transition is off under reduced motion, so contrast is measured at rest.
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await page.keyboard.press('Shift+Slash');
    await expect(sheet(page)).toBeVisible();
    expect(await axeViolations(page, (axe) => axe.include('dialog[open]'))).toEqual([]);

    await sheet(page).getByRole('switch').click();
    expect(await axeViolations(page, (axe) => axe.include('dialog[open]'))).toEqual([]);
  });
}
