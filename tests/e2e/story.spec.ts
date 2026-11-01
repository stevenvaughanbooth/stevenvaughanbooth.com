import { readFileSync } from 'node:fs';
import { expect, type Locator, test } from '@playwright/test';
import { homeMeasurement, measured, percent } from '@/components/story/measured';
import { siteComponents } from '@/content/components';
import { person } from '@/content/profile';
import { hydrated } from './helpers';

// The floor CI enforces, read from the same file Lighthouse CI uses.
const lighthouse = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
const floor: number =
  lighthouse.ci.assert.assertMatrix[0].assertions['categories:performance'][1].minScore;

test('the footer’s “Under the hood” link opens the page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Under the hood' }).click();

  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page).toHaveTitle(/^Under the hood/);
  await expect(page.getByRole('heading', { level: 1, name: 'Under the hood' })).toBeVisible();
  await expect(page.locator('#components')).toBeVisible();
});

test('the hero’s line under the proof strip opens it too', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: person.name });
  const link = hero.locator('a[href="/colophon"]');
  await expect(link).toBeVisible();
  // Below the proof strip, and still in the hero rather than crowding the text above it.
  const strip = await hero.locator('dl').boundingBox();
  const line = await link.boundingBox();
  expect(line!.y).toBeGreaterThanOrEqual(strip!.y + strip!.height);
  expect(line!.height).toBeGreaterThanOrEqual(24);

  await link.click();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Under the hood');
});

test('Claude Code gets one line, low on the page, and never the page’s name', async ({ page }) => {
  await page.goto('/colophon');
  const article = page.locator('article').first();
  expect((await article.innerText()).match(/Claude Code/g)).toHaveLength(1);
  await expect(page.locator('#source')).toContainText('Claude Code');
  const headings = await page.locator('h1, h2, h3, h4, h5').allTextContents();
  expect(headings.filter((text) => text.includes('Claude Code'))).toEqual([]);
  await expect(page.locator('body')).not.toContainText('How I built this');
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).not.toContain('Claude Code');
  for (const property of ['og:title', 'og:description']) {
    const content = await page.locator(`meta[property="${property}"]`).getAttribute('content');
    expect(content, property).not.toContain('Claude Code');
  }
});

test('leads with the components, and numbers its sections as its navigation does', async ({
  page,
}) => {
  await page.goto('/colophon');
  const nav = page.getByRole('navigation', { name: 'On this page' });
  const linked = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')?.slice(1)));
  const rendered = await page
    .locator('article section[id]')
    .evaluateAll((sections) => sections.map((section) => section.id));
  expect(rendered).toEqual(linked);
  expect(rendered[0]).toBe('components');

  const numbers = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.querySelector('[aria-hidden]')?.textContent));
  for (const [i, id] of rendered.entries()) {
    const section = page.locator(`#${id}`);
    // Every section is named by its h2, and its label carries the number the navigation shows.
    await expect(section).toHaveAccessibleName(/\S/);
    await expect(section.locator('p.label').first()).toContainText(numbers[i] ?? '');
    expect(numbers[i]).toBe(String(i + 1).padStart(2, '0'));
  }
});

test('the prerendered HTML holds every component on the map', async ({ page, request }) => {
  const html = await (await request.get('/colophon')).text();
  for (const component of siteComponents) {
    expect(html, component.id).toContain(`id="component-${component.id}"`);
  }

  await page.goto('/colophon');
  await expect(page.locator('[data-component="colophon"]')).toHaveCount(1);
  const map = page.locator('#components');
  for (const component of siteComponents) {
    const card = map.locator(`#component-${component.id}`);
    await expect(card).toHaveAccessibleName(component.name);
    await expect(card.getByRole('heading').first()).toHaveText(`<${component.name} />`);
  }
});

test('“Peel back this page” turns X-ray on and off, and says whether it is on', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/colophon');
  await hydrated(page);
  const button = page.locator('article header').getByRole('button', {
    name: 'Peel back this page',
  });
  const header = page.getByRole('banner').getByRole('button', {
    name: 'X-ray this page',
    exact: true,
  });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('type', 'button');
  // X-ray mode's listener picks up presses on any element with the attribute, whatever its value.
  await expect(button).toHaveAttribute('data-xray-toggle');
  // Its name stays the same; the pressed state, kept in step with the header's toggle, says it all.
  await expect(button).toHaveAttribute('aria-pressed', 'false');

  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(header).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveAccessibleName('Peel back this page');

  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(header).toHaveAttribute('aria-pressed', 'false');
});

test('the results show the measured numbers and the floor from lighthouserc.json', async ({
  page,
}) => {
  await page.goto('/colophon');
  const results = page.locator('#results');

  await expect(results).toContainText(measured.lighthouse);
  const values = await results.locator('dd').allTextContents();
  expect(values).toContain(String(homeMeasurement.performance));
  expect(values).toContain(String(measured.tests.unit));
  expect(values).toContain(String(measured.tests.e2e.passed));
  const caveat = results.getByRole('region', { name: 'The caveat' });
  await expect(caveat).toContainText(`So CI’s floor is ${percent(floor)}`);
  // The CI range sits beside the local score from its own round, not today's.
  await expect(caveat).toContainText(
    `while my local build scored ${measured.ciRunners.localThen}.`,
  );
});

test('the page fits the viewport with no sideways scrolling', async ({ page }) => {
  await page.goto('/colophon');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  // Negative where a classic scrollbar's stable gutter is reserved (Linux CI); never positive.
  expect(overflow).toBeLessThanOrEqual(0);
});

test('has a share image of its own, for Open Graph and X', async ({ page, request }) => {
  await page.goto('/colophon');
  for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const url = await page.locator(selector).getAttribute('content');
    expect(url, selector).toMatch(/\/colophon\/(opengraph|twitter)-image/);
    const image = await request.get(new URL(url!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
  }
});

test('the section nav stays under the header while the page scrolls, without moving it', async ({
  page,
}) => {
  await page.goto('/colophon');
  const nav = page.getByRole('navigation', { name: 'On this page' });
  const before = await page.locator('#components').boundingBox();
  await page.locator('#stack').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 400));
  const header = await page.getByRole('banner').boundingBox();
  const stuck = await nav.boundingBox();
  // Right under the fixed header, on one row.
  expect(Math.abs(stuck!.y - (header!.y + header!.height))).toBeLessThanOrEqual(2);
  expect(stuck!.height).toBeLessThan(64);

  // A link lands its section's label below the nav, not under it, and the nav marks it as read.
  const budgets = nav.getByRole('link', { name: /Budgets/ });
  await budgets.click();
  await expect(page).toHaveURL(/#budgets$/);
  await expect
    .poll(async () => (await page.locator('#budgets p.label').first().boundingBox())!.y)
    .toBeGreaterThanOrEqual(stuck!.y + stuck!.height);
  const reading = (link: Locator) =>
    link.evaluate((element) => getComputedStyle(element).getPropertyValue('--colophon-on').trim());
  await expect.poll(() => reading(budgets)).toBe('1');
  expect(await reading(nav.getByRole('link', { name: /Stack/ }))).toBe('0');

  // Being sticky moved nothing: the first section starts where it did.
  await page.evaluate(() => scrollTo(0, 0));
  expect((await page.locator('#components').boundingBox())!.y).toBeCloseTo(before!.y, 0);
});

test('describes live answers as they are: on only when switched on', async ({ page }) => {
  await page.goto('/colophon');
  const ask = page.locator('#ask-steven');
  await expect(ask.getByRole('heading', { level: 2 })).toHaveText(
    'Live answers, with the key locked away.',
  );
  await expect(ask).toContainText('When live answers are on, other questions go to Claude');
  await expect(ask).toContainText('Ctrl+K');
  await expect(page.locator('#stack')).toContainText('when live answers are on');
  await expect(page.locator('#stack')).toContainText('Three.js');
  await expect(page.locator('article').first()).not.toContainText(/colour|behaviour/);
});
