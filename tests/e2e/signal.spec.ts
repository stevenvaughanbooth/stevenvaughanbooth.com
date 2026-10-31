import { expect, type Locator, type Page, test } from '@playwright/test';
import { person } from '@/content/profile';

// The sections whose labels carry a node, in reading order: the stations on the line.
const stations = ['open-source', 'work', 'experience', 'contact'];

const line = (page: Page) => page.locator('[data-signal="line"]');
const nodes = (page: Page) => page.locator('[data-signal="node"]');
const email = (page: Page) => page.locator('#contact').getByRole('link', { name: person.email });

/** Finishes the one-time intro, so the line's head sits where scrolling alone puts it. */
async function settle(page: Page) {
  await line(page).evaluate((el) => {
    for (const animation of el.getAnimations({ subtree: true })) {
      if (animation.timeline === document.timeline) animation.finish();
    }
  });
}

/** Scrolls until the element's centre sits `y` pixels from the top of the viewport. */
async function placeAt(target: Locator, y: number) {
  await target.evaluate(async (el, at) => {
    // A section may still be rising into place, so measure again once it has moved.
    for (let pass = 0; pass < 3; pass++) {
      const box = el.getBoundingClientRect();
      scrollBy({ top: box.top + box.height / 2 - at, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  }, y);
}

/** How lit a node is: the opacity of its green fill, from 0 to 1. */
const lit = (node: Locator) =>
  node.evaluate((el) => Number(getComputedStyle(el, '::after').opacity));

/** Progress (0 to 1) of every scroll-driven animation in the element and its pseudo-elements. */
const scrollProgress = (target: Locator) =>
  target.evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((animation) => animation.timeline !== document.timeline)
      .map((animation) => animation.effect?.getComputedTiming().progress ?? null),
  );

/**
 * How much of the address's green underline shows, from 0 to 1: the share its clip leaves
 * uncovered. The copy of the address carries the underline in its ::after.
 */
const underlined = (page: Page) =>
  page.locator('#contact [data-address]').evaluate((el) => {
    const style = getComputedStyle(el, '::after');
    if (style.display === 'none' || !style.textDecorationLine.includes('underline')) return 0;
    // inset(top right bottom left), with right and left omitted when they repeat.
    const [, right = '0', , left = right] = style.clipPath.match(/^inset\((.*)\)$/)![1]!.split(' ');
    const width = el.getBoundingClientRect().width;
    const px = (value: string) =>
      value.endsWith('%') ? (parseFloat(value) / 100) * width : parseFloat(value);
    return Math.max(0, (width - px(right) - px(left)) / width);
  });

/** Where the line's head is, in viewport pixels from the top. */
const head = (page: Page) =>
  line(page).evaluate(
    (el) => el.querySelector(':scope > div > div')!.getBoundingClientRect().bottom,
  );

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the line is drawn from the md breakpoint up');

  test('runs in the gutter from the hero’s status dot to the email address', async ({ page }) => {
    await page.goto('/');
    await expect(line(page)).toBeVisible();

    const geometry = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
      };
      const anchor = (name: string) =>
        [...document.querySelectorAll('*')].find(
          (el) => getComputedStyle(el).getPropertyValue('anchor-name') === name,
        );
      const label = (node: Element) => node.parentElement!;
      return {
        line: box(document.querySelector('[data-signal="line"]')!),
        origin: box(anchor('--signal-origin')!),
        end: box(anchor('--signal-end')!),
        nodes: [...document.querySelectorAll('[data-signal="node"]')].map((node) => ({
          section: node.closest('section')?.id,
          node: box(node),
          label: box(label(node)),
        })),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const { line: rail, origin, end } = geometry;
    const middle = (box: { top: number; bottom: number }) => (box.top + box.bottom) / 2;

    // From the dot's centre, beside it, down to the email's centre; left of the content edge.
    expect(Math.abs(rail.top - middle(origin))).toBeLessThanOrEqual(1);
    expect(Math.abs(rail.bottom - middle(end))).toBeLessThanOrEqual(1);
    expect(Math.abs(rail.right - origin.left)).toBeLessThanOrEqual(1);
    expect(rail.left).toBeGreaterThanOrEqual(8);
    expect(rail.left).toBeLessThanOrEqual(end.left - 16);

    // One node per station, centred on the line, clear of its label's text.
    expect(geometry.nodes.map((entry) => entry.section)).toEqual(stations);
    for (const { node, label } of geometry.nodes) {
      expect(Math.abs((node.left + node.right) / 2 - (rail.left + 0.5))).toBeLessThanOrEqual(1);
      expect(node.right).toBeLessThanOrEqual(label.left - 8);
    }

    // Decoration only: no horizontal scroll, and it never takes a click.
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    await expect(line(page)).toHaveCSS('pointer-events', 'none');
    await expect(nodes(page).first()).toHaveCSS('pointer-events', 'none');
    expect(await email(page).evaluate((el) => getComputedStyle(el, '::before').pointerEvents)).toBe(
      'none',
    );
  });

  test('lights each node as the head of the line reaches it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await settle(page);
    await placeAt(nodes(page).first(), 200);
    // The head holds one height in the viewport, wherever the page is scrolled.
    const height = await head(page);

    for (const id of stations) {
      const node = page.locator(`#${id} [data-signal="node"]`);

      await placeAt(node, height + 48);
      expect(Math.abs((await head(page)) - height), `head while ${id} is ahead`).toBeLessThan(1.5);
      expect(await lit(node), `${id} before the line reaches it`).toBeLessThan(0.05);

      await placeAt(node, height - 48);
      expect(Math.abs((await head(page)) - height), `head once ${id} is passed`).toBeLessThan(1.5);
      expect(await lit(node), `${id} once the line has passed it`).toBe(1);
    }
  });

  test('arrives at the email before the page runs out', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await settle(page);
    await placeAt(nodes(page).first(), 200);
    const height = await head(page);

    // Short of the address, the turn into the envelope and the underline have not started.
    await placeAt(email(page), height + 48);
    expect(await scrollProgress(email(page))).toEqual([0, 0]);
    expect(await underlined(page)).toBe(0);

    // At the very bottom, the line, the turn and the underline are complete. If Contact or the
    // footer get shorter than the signal's reach, this is what fails.
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect.poll(() => scrollProgress(email(page))).toEqual([1, 1]);
    expect(await scrollProgress(line(page))).toEqual([1]);
    expect(await underlined(page)).toBe(1);
  });

  test('holds still, drawn in full, under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const { animations, rail, trace } = await line(page).evaluate((el) => ({
      animations: el.getAnimations({ subtree: true }).length,
      rail: el.getBoundingClientRect().toJSON() as DOMRect,
      trace: el.querySelector(':scope > div > div')!.getBoundingClientRect().toJSON() as DOMRect,
    }));
    expect(animations).toBe(0);
    expect(trace.top).toBeCloseTo(rail.top, 0);
    expect(trace.bottom).toBeCloseTo(rail.bottom, 0);
    for (const node of await nodes(page).all()) expect(await lit(node)).toBe(1);
    expect(await email(page).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'below md the nodes stand alone');

  test('has no line; each label leads with a node that lights as it is reached', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(line(page)).toBeHidden();
    await expect(nodes(page)).toHaveCount(stations.length);

    const viewport = page.viewportSize()!;
    for (const node of await nodes(page).all()) {
      // Inline, before the label's text, inside the content column.
      const { node: dot, text } = await node.evaluate((el) => {
        const rest = document.createRange();
        rest.setStartAfter(el);
        rest.setEndAfter(el.parentElement!.lastChild!);
        return {
          node: el.getBoundingClientRect().toJSON() as DOMRect,
          text: rest.getBoundingClientRect().toJSON() as DOMRect,
        };
      });
      expect(dot.left).toBeGreaterThanOrEqual(16);
      expect(dot.right).toBeLessThanOrEqual(text.left - 4);

      await placeAt(node, viewport.height - 40);
      expect(await lit(node)).toBeLessThan(0.05);
      await placeAt(node, 120);
      expect(await lit(node)).toBe(1);
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
});

test('underlines the address in full, holding still, under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Wherever the page is scrolled: before the arrival, and at the very end.
  expect(await underlined(page)).toBe(1);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  expect(await underlined(page)).toBe(1);
});

test('is drawn only on the page that has both of its ends', async ({ page }) => {
  await page.goto('/colophon');
  await expect(line(page)).toBeHidden();
  await expect(nodes(page)).toHaveCount(0);
});

for (const [where, media] of [
  ['in print', { media: 'print' }],
  ['in forced colours', { forcedColors: 'active' }],
] as const) {
  test(`steps aside ${where}`, async ({ page }) => {
    await page.emulateMedia(media);
    await page.goto('/');
    await expect(line(page)).toBeHidden();
    for (const node of await nodes(page).all()) await expect(node).toBeHidden();
    const pseudo = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => [
          getComputedStyle(el, '::before').content,
          getComputedStyle(el, '::after').display,
        ]);
    // No turn into the envelope, and no copy of the address.
    expect((await pseudo(`#contact a[href="${person.links.email}"]`))[0]).toBe('none');
    expect((await pseudo('[data-address]'))[1]).toBe('none');
  });
}

test('leaves the email link named by the address alone', async ({ page }) => {
  await page.goto('/');
  // Chromium's own accessibility tree, which includes CSS generated content: the underline's copy
  // of the address must not be read a second time. Chromium reads the <wbr> as a space.
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send('DOM.getDocument');
  const { nodes: links } = await cdp.send('Accessibility.queryAXTree', {
    nodeId: root.nodeId,
    role: 'link',
  });
  const names = links.map((link) => String(link.name?.value ?? '').replace(/\s+/g, ''));
  expect(names.filter((name) => name.includes(person.email))).toEqual([person.email]);
});
