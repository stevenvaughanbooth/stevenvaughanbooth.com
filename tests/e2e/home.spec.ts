import { expect, test } from '@playwright/test';
import { person, recognitionAnchor, sections, site, sourceNote } from '@/content/profile';

// The page's sections, in reading order, come from the same list the navigation is built from.
const ids = sections.map((section) => section.id);

test('renders the hero and every section in reading order', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(site.title);
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible();
  await expect(page.locator('main').getByText(person.headline)).toBeVisible();
  await expect(page.locator(`main a[href="${person.links.email}"]`).first()).toBeVisible();

  const rendered = await page
    .locator('main > section[id]')
    .evaluateAll((els) => els.map((el) => el.id));
  expect(rendered).toEqual(ids);
  for (const id of ids) {
    await expect(page.locator(`#${id}`).getByRole('heading', { level: 2 }).first()).toBeVisible();
  }
  // The awards are part of Experience, under their own anchor so old /#recognition links land.
  await expect(page.locator(`#experience #${recognitionAnchor}`)).toBeVisible();
});

for (const path of ['/', '/colophon']) {
  test(`${path} logs no console errors or uncaught exceptions`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto(path);
    // Scroll through the page so lazily mounted islands get a chance to run.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
}

test('the home page names its canonical URL and share card; the 404 page claims neither', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', site.url);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', site.url);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  // The footer speaks as Steven, like the rest of the page.
  await expect(page.getByRole('contentinfo')).toContainText(sourceNote);

  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
    'content',
    site.title,
  );
});

test('serves a favicon.ico and a security.txt with the profile’s email', async ({ request }) => {
  const favicon = await request.get('/favicon.ico');
  expect(favicon.status()).toBe(200);
  expect((await favicon.body()).subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));

  const security = await request.get('/.well-known/security.txt');
  expect(security.status()).toBe(200);
  expect(await security.text()).toContain(`Contact: mailto:${person.email}`);
});
