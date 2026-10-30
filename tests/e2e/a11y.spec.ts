import { expect, test } from '@playwright/test';
import { axeViolations } from './helpers';

for (const path of ['/', '/colophon']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${path} in ${colorScheme} has no serious or critical axe violations`, async ({
      page,
    }) => {
      // Reduced motion renders every reveal in its final state, so the whole page is checked at
      // rest. The pass below covers the frames a reader sees while sections move into place.
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(path);

      expect(await axeViolations(page)).toEqual([]);
    });
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`scroll reveals keep text contrast mid-animation (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
    await page.goto('/');
    const reveals = page.locator('.reveal');
    const count = await reveals.count();
    expect(count).toBeGreaterThan(0);
    let moving = 0;

    for (let index = 0; index < count; index++) {
      // Park the section's top at 70% of the viewport height, where a reader may stop scrolling
      // while its scroll-driven reveal is still running, then let the animation catch up.
      const { name, progress } = await reveals.nth(index).evaluate(async (element, n) => {
        element.setAttribute('data-axe-reveal', String(n));
        const top = element.getBoundingClientRect().top + scrollY - innerHeight * 0.7;
        scrollTo({ top, behavior: 'instant' });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const timing = element.getAnimations()[0]?.effect?.getComputedTiming();
        return { name: element.id || `.reveal ${n}`, progress: timing?.progress ?? null };
      }, index);
      if (progress !== null && progress > 0 && progress < 1) moving += 1;

      // A diagram's tour may be crossfading its step copy. That is brief, so wait it out and
      // retry; a reveal that dims text holds still at this scroll position and fails every time.
      await expect(async () => {
        await page.waitForFunction(
          () =>
            !document
              .getAnimations()
              .some((a) => a instanceof CSSTransition && a.playState === 'running'),
        );
        const violations = await axeViolations(page, (axe) =>
          axe.include(`[data-axe-reveal="${index}"]`).withRules(['color-contrast']),
        );
        expect(violations, name).toEqual([]);
      }).toPass({ timeout: 10_000 });
    }
    // Otherwise this would only re-check frames at rest, which the pass above already covers.
    expect(moving, 'sections caught mid-reveal').toBeGreaterThan(0);
  });
}
