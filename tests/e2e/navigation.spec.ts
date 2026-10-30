import { expect, type Page, test } from '@playwright/test';
import { sections } from '@/content/profile';
import { hydrated } from './helpers';

const navSections = sections.filter((section) => section.nav);

/** Whether the focused element is inside the section with this id. */
const focusIsIn = (page: Page, id: string) =>
  page.evaluate((target) => Boolean(document.activeElement?.closest(`#${target}`)), id);

test('every in-page link targets an element that exists', async ({ page, baseURL }) => {
  const targets = new Map<string, Set<string>>();

  for (const path of ['/', '/colophon']) {
    await page.goto(path);
    const hrefs = await page
      .locator('a[href*="#"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== new URL(baseURL!).origin || url.hash.length < 2) continue;
      const ids = targets.get(url.pathname) ?? new Set();
      ids.add(decodeURIComponent(url.hash.slice(1)));
      targets.set(url.pathname, ids);
    }
  }

  expect(targets.size).toBeGreaterThan(0);
  for (const [pathname, ids] of targets) {
    await page.goto(pathname);
    const missing = await page.evaluate(
      (list) => list.filter((id) => !document.getElementById(id)),
      [...ids],
    );
    expect(missing, `missing anchors on ${pathname}`).toEqual([]);
  }
});

test('primary navigation scrolls each section into view', async ({ page }) => {
  // Instant scrolling, so one smooth scroll can't still be running when the next link fires.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // A CSS locator, because below the md breakpoint the bar is display:none and out of the a11y tree.
  const links = page.locator('nav[aria-label="Primary"] a[href*="#"]');
  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);

  for (const [index, href] of hrefs.entries()) {
    const id = href.split('#')[1];
    expect(id, `${href} has a fragment`).toBeTruthy();
    const link = links.nth(index);
    if (await link.isVisible()) await link.click();
    else await page.goto(href);

    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
});

test('the skip link moves keyboard focus past the header into main', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  // It is visually hidden until focused, then shown on screen.
  expect((await skip.boundingBox())?.width).toBeGreaterThan(40);
  await expect(skip).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main')))).toBe(true);
});

test.describe('section links move keyboard focus into the section', () => {
  for (const { id, label } of navSections) {
    test(`header link to ${label}: the next Tab continues inside it`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'the header links are hidden below md; the Sections menu replaces them');
      await page.goto('/');
      const link = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
        name: label,
        exact: true,
      });
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`#${id}$`));

      await page.keyboard.press('Tab');
      await expect.poll(() => focusIsIn(page, id)).toBe(true);
    });

    test(`Sections menu link to ${label}: focus lands on its heading`, async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, 'the Sections menu is shown only below md');
      await page.goto('/');
      // The menu's links move focus in a click handler, so wait for it.
      await hydrated(page);
      const menuButton = page.getByRole('button', { name: 'Sections', exact: true });
      const menu = page.locator('#mobile-nav');
      await menuButton.focus();
      await page.keyboard.press('Enter');
      await expect(menu).toBeVisible();

      await menu.getByRole('link', { name: label, exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id} h2`)).toBeFocused();

      await page.keyboard.press('Tab');
      await expect.poll(() => focusIsIn(page, id)).toBe(true);
    });
  }
});
