import { expect, type Page, test } from '@playwright/test';
import { adage, sections } from '@/content/profile';
import { hydrated, themeToggle } from './helpers';

declare global {
  interface Window {
    __viewTransitions?: number;
    __evidenceShifts?: string[];
  }

  /** The Layout Instability API's entry, which TypeScript's DOM types don't include yet. */
  interface LayoutShift extends PerformanceEntry {
    value: number;
    sources: { node: Node | null }[];
  }
}

test.describe('theme reveal', () => {
  test('the new theme grows from the toggle in a view transition', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    await page.goto('/');
    await hydrated(page);
    const box = (await themeToggle(page).boundingBox())!;

    await themeToggle(page).click();
    const reveal = await page.waitForFunction(() => {
      const animation = document
        .getAnimations()
        .find((a) => (a as CSSAnimation).animationName === 'theme-reveal');
      if (!animation) return null;
      const style = document.documentElement.style;
      return {
        target: (animation.effect as KeyframeEffect).pseudoElement,
        x: parseFloat(style.getPropertyValue('--reveal-x')),
        y: parseFloat(style.getPropertyValue('--reveal-y')),
      };
    });
    const { target, x, y } = (await reveal.jsonValue())!;
    expect(target).toBe('::view-transition-new(root)');
    expect(x).toBeCloseTo(box.x + box.width / 2, 0);
    expect(y).toBeCloseTo(box.y + box.height / 2, 0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Once the reveal ends, its origin is cleared from the root.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('style') ?? ''))
      .not.toContain('--reveal');
  });

  test('under reduced motion the theme switches at once', async ({ page }) => {
    await page.addInitScript(() => {
      const start = document.startViewTransition.bind(document);
      window.__viewTransitions = 0;
      document.startViewTransition = (options) => {
        window.__viewTransitions! += 1;
        return start(options);
      };
    });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);

    await themeToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => window.__viewTransitions)).toBe(0);
  });
});

test.describe('reading marks', () => {
  const navSections = sections.filter((section) => section.nav);

  /** How far each header item's bar is drawn, from 0 to 1. */
  const bars = (page: Page) =>
    page
      .locator('nav[aria-label="Primary"] li')
      .evaluateAll((items) =>
        items.map((item) => parseFloat(getComputedStyle(item.lastElementChild!).scale)),
      );

  test('the header marks the section being read', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the header links are hidden below md; the Sections menu replaces them');
    // Instant scrolling, and the marks move in one step.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await bars(page)).toEqual(navSections.map(() => 0));

    const nav = page.getByRole('navigation', { name: 'Primary' });
    /** Which labels are drawn brighter than the rest. */
    const bright = () =>
      nav.getByRole('link').evaluateAll((links) => {
        const colours = links.map((link) => getComputedStyle(link).color);
        const rest = colours.find((colour) => colours.filter((c) => c === colour).length > 1);
        return colours.map((colour) => colour !== rest);
      });

    for (const [index, { label }] of navSections.entries()) {
      await nav.getByRole('link', { name: label, exact: true }).click();
      // Off the link, so hover doesn't brighten it too.
      await page.mouse.move(0, 400);
      await expect.poll(() => bars(page)).toEqual(navSections.map((_, i) => (i === index ? 1 : 0)));
      await expect.poll(bright).toEqual(navSections.map((_, i) => i === index));
    }
  });

  test('the bar glides between items as one section hands over to the next', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the header links are hidden below md');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    // The reading line sits 30% down the screen; park the second section's top on it.
    await page.evaluate((id) => {
      const top = document.getElementById(id)!.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top - innerHeight * 0.3, behavior: 'instant' });
    }, navSections[1]!.id);
    await expect
      .poll(async () => (await bars(page)).map((value) => Math.round(value * 10) / 10))
      .toEqual(navSections.map((_, i) => (i < 2 ? 0.5 : 0)));
  });

  test('pages without the sections mark nothing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the header links are hidden below md');
    await page.goto('/colophon');
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect.poll(() => bars(page)).toEqual(navSections.map(() => 0));
  });

  test('the Sections menu marks the section being read', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the Sections menu is shown only below md');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    const current = navSections[2]!;
    await page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), current.id);

    await page.getByRole('button', { name: 'Sections', exact: true }).click();
    const dots = () =>
      page
        .locator('#mobile-nav li')
        .evaluateAll((items) =>
          items.map((item) => getComputedStyle(item.querySelector('[aria-hidden]')!).opacity),
        );
    await expect.poll(dots).toEqual(navSections.map(({ id }) => (id === current.id ? '1' : '0')));
  });
});

test.describe('evidence figures', () => {
  const [first] = adage.evidence.results;
  const figure = (page: Page) =>
    page
      .getByRole('region', { name: 'Evidence so far' })
      .locator('[data-suffix]')
      .filter({ hasText: first.value });
  /** The number the figure draws: its ::after counter. */
  const drawn = (page: Page) =>
    figure(page).evaluate((element) =>
      Number(getComputedStyle(element, '::after').getPropertyValue('--count')),
    );

  test('count up once as they scroll in, with the real figure in the text throughout', async ({
    page,
  }, testInfo) => {
    // On GitHub's Linux runners, Pixel 7 emulation starts the trigger at load, so the count has
    // already run before the figure scrolls in. The real figure is in the text either way.
    test.fixme(
      Boolean(process.env.CI) && testInfo.project.name === 'mobile',
      'timeline-trigger fires at load under Linux mobile emulation',
    );
    // Layout shifts in the evidence card, or in generated content, which has no node to name.
    await page.addInitScript(() => {
      window.__evidenceShifts = [];
      new PerformanceObserver((list) => {
        const card = document.querySelector('[aria-labelledby="adage-evidence-title"]');
        for (const entry of list.getEntries() as LayoutShift[]) {
          const nodes = entry.sources.map((source) => source.node);
          if (nodes.length === 0 || nodes.some((node) => node && card?.contains(node))) {
            const names = nodes.map((node) => node?.textContent?.slice(0, 24) ?? 'a removed node');
            window.__evidenceShifts!.push(names.join(', ') || 'generated content');
          }
        }
      }).observe({ type: 'layout-shift' });
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const target = parseInt(first.value, 10);
    expect(await drawn(page)).toBe(target);

    // Scroll down in steps, as a reader would, until the figure has come into view.
    await page.mouse.move(200, 200);
    await expect(async () => {
      await page.mouse.wheel(0, 150);
      await expect(figure(page)).toBeInViewport({ timeout: 100 });
    }).toPass();
    await expect.poll(() => drawn(page)).toBeLessThan(target);
    // Screen readers, search and copy only ever meet the real figure.
    await expect(figure(page)).toHaveText(first.value);
    expect(await figure(page).locator('..').ariaSnapshot()).toContain(
      `${first.value} ${first.label}`,
    );
    await expect.poll(() => drawn(page)).toBe(target);
    // Counting never moves anything, though the digits have proportional widths.
    expect(await page.evaluate(() => window.__evidenceShifts)).toEqual([]);

    // Once: scrolling away and back leaves it at rest.
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await figure(page).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 40);
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(100);
      expect(await drawn(page)).toBe(target);
    }
  });

  test('show the real figure, as text, under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const text = figure(page).locator('span');
    await expect(text).toHaveText(first.value);
    expect(await text.evaluate((element) => getComputedStyle(element).color)).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(
      await figure(page).evaluate((element) => getComputedStyle(element, '::after').content),
    ).toBe('none');
  });
});

test('a diagram tour holds while a dialog covers the page', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await hydrated(page);
  const card = page.locator('#work-platform');
  const tablist = card.getByRole('tablist', { name: 'Platform stories' });
  await tablist.evaluate((element) =>
    scrollTo(0, element.getBoundingClientRect().top + scrollY - 120),
  );
  await expect(card.getByRole('button', { name: 'Pause auto-advance' })).toBeVisible();
  const phase = card.locator('[aria-current="step"]');
  const before = await phase.textContent();

  const status = card.getByText(/^(Auto-advancing|Paused while you look)$/);
  await expect(status).toHaveText('Auto-advancing');

  // The shortcuts sheet covers the page: the tour holds however long it stays open.
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await page.keyboard.press('Shift+Slash');
  await expect(sheet).toBeVisible();
  await expect(status).toHaveText('Paused while you look');
  await page.clock.runFor(30_000);
  await expect(phase).toHaveText(before!);

  // Closed again, it carries on.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(status).toHaveText('Auto-advancing');
  await page.clock.runFor(7_000);
  await expect(phase).not.toHaveText(before!);
});
