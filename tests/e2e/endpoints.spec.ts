import { expect, test } from '@playwright/test';
import { person, site } from '@/content/profile';

test('/profile.json serves the structured profile as JSON', async ({ request }) => {
  const response = await request.get('/profile.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/json\b/);

  const body = await response.json();
  expect(body.name).toBe(person.name);
  expect(JSON.stringify(body)).toContain(person.links.github);
});

test('/llms.txt serves a plain-text guide for agents', async ({ request }) => {
  const response = await request.get('/llms.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/(plain|markdown)\b/);

  const text = await response.text();
  expect(text.startsWith(`# ${person.name}`)).toBe(true);
  expect(text).toContain('profile.json');
});

test('robots.txt and sitemap.xml point crawlers at the canonical site', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${site.url}/sitemap.xml`);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  expect(await sitemap.text()).toContain(`<loc>${site.url}`);
});

test('the Open Graph image is declared and renders', async ({ page, request }) => {
  await page.goto('/');
  const og = page.locator('meta[property="og:image"]').first();
  const content = await og.getAttribute('content');
  expect(content, 'og:image meta tag').toBeTruthy();
  await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute(
    'content',
    '1200',
  );
  await expect(page.locator('meta[property="og:image:height"]').first()).toHaveAttribute(
    'content',
    '630',
  );

  // metadataBase makes the URL absolute to production; fetch the same path from this server.
  const { pathname, search } = new URL(content!);
  const image = await request.get(pathname + search);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toMatch(/^image\/(png|jpeg)$/);
});

test('an unknown route renders the 404 page inside the site chrome', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();

  // Exactly one directive, and it must not contradict noindex with an inherited "index".
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((metas) => metas.map((meta) => meta.getAttribute('content')));
  expect(robots).toEqual([expect.stringMatching(/noindex/)]);
});
