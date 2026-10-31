import { expect, type Page, test } from '@playwright/test';
import { axeViolations, hydrated } from './helpers';

/** Scrolls through the page, so sections that reveal or load as they near view are laid out. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    scrollTo(0, 0);
  });
}

/** The page's scroll and client widths, and the elements that stick out past its right edge. */
const widths = (page: Page) =>
  page.evaluate(() => {
    const { scrollWidth, clientWidth } = document.documentElement;
    const clips = (element: Element) =>
      getComputedStyle(element).overflowX !== 'visible' &&
      element.getBoundingClientRect().right <= clientWidth;
    const overflowing = [...document.body.querySelectorAll('*')]
      .filter((element) => {
        if (element.getBoundingClientRect().right <= clientWidth + 0.5) return false;
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (clips(parent)) return false;
        }
        return true;
      })
      .map((element) => `${element.tagName.toLowerCase()} ${element.getAttribute('class') ?? ''}`);
    return { scrollWidth, clientWidth, overflowing };
  });

test.describe('reflow at 320 CSS pixels (WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ['/', '/colophon', '/work/mcp']) {
    test(`${path} reflows without scrolling sideways`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await hydrated(page);
      await scrollThrough(page);
      const { scrollWidth, clientWidth, overflowing } = await widths(page);
      expect(scrollWidth, overflowing.join('\n')).toBeLessThanOrEqual(clientWidth);
      // Nothing reflows into a region that scrolls on its own, out of reach of the keyboard.
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe('the hero’s suggestions', () => {
  // The middle suggestion shows only where all three fit on one row. Elsewhere the first and the
  // last keep to one row, or two where the column is narrow, never three.
  const layouts = [
    { width: 390, shown: 2, rows: 2 },
    { width: 768, shown: 2, rows: 2 },
    { width: 1024, shown: 2, rows: 1 },
    { width: 1440, shown: 3, rows: 1 },
  ];

  for (const { width, shown, rows } of layouts) {
    test(`at ${width}px, ${shown} suggestions take at most ${rows === 1 ? 'one row' : 'two rows'}`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'the widths are set here, not by the device');
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const group = page.getByRole('group', { name: 'Try' });
      await expect(group.getByRole('button')).toHaveCount(shown);
      // The tops of the "Try" label and the suggestions shown, top to bottom. The label sits a
      // few pixels lower than the suggestions on its row; a new row starts a full row lower.
      const tops = await group.evaluate((element) =>
        [...element.children]
          .filter((child) => getComputedStyle(child).display !== 'none')
          .map((child) => child.getBoundingClientRect().top)
          .sort((a, b) => a - b),
      );
      const rowCount = tops.filter(
        (top, index) => index === 0 || top - tops[index - 1]! > 16,
      ).length;
      expect(rowCount).toBeLessThanOrEqual(rows);
    });
  }
});
