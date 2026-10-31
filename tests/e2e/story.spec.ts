import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fraction, homeMeasurement, measured } from '@/components/story/measured';
import { afterLaunch, timeline } from '@/components/story/story';
import { person } from '@/content/profile';

// The floor CI enforces, read from the same file Lighthouse CI uses.
const lighthouse = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
const floor: number = lighthouse.ci.assert.assertions['categories:performance'][1].minScore;

test('the footer’s “How I built this” link opens the story', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'How I built this' }).click();

  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page).toHaveTitle(/^How I built this/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'How I built this site with Claude Code' }),
  ).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Who did what' })).toBeVisible();
});

test('the hero’s line under the proof strip opens the story too', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('region', { name: person.name });
  const link = hero.getByRole('link', { name: 'How I built this site with Claude Code' });
  await expect(link).toBeVisible();
  // Below the proof strip, and still in the hero rather than crowding the text above it.
  const strip = await hero.locator('dl').boundingBox();
  const line = await link.boundingBox();
  expect(line!.y).toBeGreaterThanOrEqual(strip!.y + strip!.height);
  expect(line!.height).toBeGreaterThanOrEqual(24);

  await link.click();
  await expect(page).toHaveURL(/\/colophon$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How I built this site with Claude Code',
  );
});

test('the day ends at launch, and round two follows under its own heading', async ({ page }) => {
  await page.goto('/colophon');
  const headings = await page
    .locator('#day')
    .locator('h3, h4')
    .evaluateAll((els) => els.map((el) => `${el.tagName.toLowerCase()} ${el.textContent}`));
  expect(headings).toEqual([
    ...timeline.map((entry) => `h3 ${entry.title}`),
    'h3 After launch',
    ...afterLaunch.map((entry) => `h4 ${entry.title}`),
  ]);
});

test('the story comes first, then the colophon, in the order of the page’s navigation', async ({
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

  // Every section is named by its h2, and the colophon's introduction sits between the parts.
  for (const id of rendered) {
    await expect(page.locator(`#${id}`)).toHaveAccessibleName(/\S/);
  }
  const between = await page.evaluate(() => {
    const [results, intro, principles] = ['results', 'colophon', 'principles'].map((id) =>
      document.getElementById(id),
    );
    return Boolean(
      results &&
      intro &&
      principles &&
      results.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING &&
      intro.compareDocumentPosition(principles) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(between).toBe(true);
});

test('“Skip to the colophon” moves keyboard focus there', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/colophon');
  await page.getByRole('link', { name: 'Skip to the colophon' }).focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/#colophon$/);
  await expect(page.locator('#colophon')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(
    page.locator('#colophon').getByRole('link', { name: 'Architecture notes' }),
  ).toBeFocused();
});

test('the brief links to how the key is protected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/colophon');
  await page.getByRole('link', { name: 'How the key is protected' }).click();

  await expect(page).toHaveURL(/#ask-steven$/);
  await expect(page.locator('#ask-steven')).toBeInViewport();
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
  await expect(caveat).toContainText(`So CI enforces a floor of ${floor.toFixed(2)}`);
  // The CI range sits beside the local score from its own round, not today's.
  await expect(caveat).toContainText(
    `where my local build scored ${fraction(measured.ciRunners.localThen)}`,
  );
});

test('the timeline dates are machine-readable and in order', async ({ page }) => {
  await page.goto('/colophon');
  const stamps = await page
    .locator('#day time')
    .evaluateAll((times) => times.map((time) => Date.parse(time.getAttribute('datetime') ?? '')));

  expect(stamps.length).toBeGreaterThan(1);
  expect(stamps.every((stamp) => Number.isFinite(stamp))).toBe(true);
  expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
});

test('the page fits the viewport with no sideways scrolling', async ({ page }) => {
  await page.goto('/colophon');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
