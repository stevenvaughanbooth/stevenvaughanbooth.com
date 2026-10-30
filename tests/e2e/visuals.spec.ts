import { expect, test } from '@playwright/test';
import { experience } from '@/content/profile';

test('the metadata tour never changes the selected tab under keyboard focus', async ({ page }) => {
  // A controllable clock, so the test can let far more than a story's dwell pass without waiting.
  await page.clock.install();
  await page.goto('/');

  const card = page.locator('#work-platform');
  const tablist = card.getByRole('tablist', { name: 'Platform stories' });
  // Put the tabs and the panel on screen, so the tour starts and counts down.
  await tablist.evaluate((element) =>
    scrollTo(0, element.getBoundingClientRect().top + scrollY - 120),
  );
  const pause = card.getByRole('button', { name: 'Pause auto-advance' });
  await expect(pause).toBeVisible();

  // The play control comes before the tabs, so it is reached first (APG carousel).
  const playFirst = await card.evaluate((element) => {
    const button = element.querySelector('button[aria-label="Pause auto-advance"]');
    const list = element.querySelector('[role="tablist"]');
    return Boolean(
      list && button?.compareDocumentPosition(list) === Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
  expect(playFirst).toBe(true);

  // Tab from the play control onto the selected tab, the tablist's only tab stop.
  await pause.focus();
  await page.keyboard.press('Tab');
  const focused = tablist.locator('[role="tab"]:focus');
  await expect(focused).toHaveAttribute('aria-selected', 'true');
  const id = await focused.getAttribute('id');

  // Focusing a tab stops the tour for good.
  await expect(card.getByRole('button', { name: 'Play auto-advance' })).toBeVisible();

  // Each 7 s outlasts a phase's 6 s dwell. A running tour moves on a story every three phases,
  // so four of them would have changed the selected tab.
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(7_000);
    await expect(focused).toHaveAttribute('id', id!);
    await expect(focused).toHaveAttribute('aria-selected', 'true');
    await expect(focused).toHaveAttribute('tabindex', '0');
  }
});

test('career roles are exclusive disclosures, with the current role open', async ({ page }) => {
  await page.goto('/');
  const roles = page.getByRole('list', { name: 'Roles at Salesforce, earliest first' });
  const role = (title: string) =>
    roles.locator('details').filter({ has: page.locator('summary', { hasText: title }) });

  const current = experience.find((r) => r.end === 'Present')!;
  const previous = experience.find((r) => r !== current)!;
  await expect(role(current.displayTitle)).toHaveAttribute('open', '');
  await expect(roles.locator('details[open]')).toHaveCount(1);

  // Opening another role closes the current one: one shared name, no JavaScript.
  await role(previous.displayTitle).locator('summary').click();
  await expect(role(previous.displayTitle)).toHaveAttribute('open', '');
  await expect(role(current.displayTitle)).not.toHaveAttribute('open');
  await expect(roles.locator('details[open]')).toHaveCount(1);

  // A disclosure can be closed again from the keyboard.
  await role(previous.displayTitle).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(roles.locator('details[open]')).toHaveCount(0);
});
