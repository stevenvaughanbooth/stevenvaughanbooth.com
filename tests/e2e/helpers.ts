import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Serious and critical axe violations, in a form that reads well in a failed assertion. */
export async function axeViolations(
  page: Page,
  configure: (builder: AxeBuilder) => AxeBuilder = (builder) => builder,
) {
  const { violations } = await configure(new AxeBuilder({ page }).withTags(wcag)).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((node) => node.target.join(' ')),
    }));
}

export const themeToggle = (page: Page) =>
  page.getByRole('button', { name: 'Dark mode', exact: true });

/**
 * Resolves once React has hydrated the page. The toggle's pressed state is unknown on the server
 * and is set by the client, so until then it has no aria-pressed at all.
 */
export async function hydrated(page: Page) {
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', /^(true|false)$/);
}

export const askTrigger = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Ask Steven', exact: true });

export const palette = (page: Page) => page.getByRole('dialog', { name: 'Ask Steven' });

/** Whether the focused element is inside `container`. */
export const focusIsWithin = (container: Locator) =>
  container.evaluate((element) => element.contains(document.activeElement));
