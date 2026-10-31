import { expect, type Page, test } from '@playwright/test';
import { caseStudies, caseStudyParts, caseStudyPath } from '@/content/case-studies';
import { person, site } from '@/content/profile';
import { axeViolations, hydrated } from './helpers';

const paths = caseStudies.map((study) => caseStudyPath(study.id));

declare global {
  interface Window {
    /** The shared-element groups each view transition animated, recorded by the init script. */
    __morphs?: string[][];
  }
}

/** Records the named groups every view transition animates, read once its animations start. */
async function recordMorphs(page: Page) {
  await page.addInitScript(() => {
    const morphs: string[][] = [];
    window.__morphs = morphs;
    const start = Document.prototype.startViewTransition;
    Document.prototype.startViewTransition = function (
      this: Document,
      update?: Parameters<Document['startViewTransition']>[0],
    ) {
      const transition = start.call(this, update);
      const groups: string[] = [];
      morphs.push(groups);
      transition.ready
        .then(() => {
          for (const animation of document.getAnimations()) {
            const name = (animation.effect as KeyframeEffect | null)?.pseudoElement?.match(
              /^::view-transition-group\((work-.+)\)$/,
            )?.[1];
            if (name) groups.push(name);
          }
        })
        .catch(() => {});
      return transition;
    };
  });
}

const lastMorph = (page: Page) => page.evaluate(() => [...(window.__morphs?.at(-1) ?? [])].sort());

/** Opens the home page at a theme, ready to follow its case study link. */
async function openTheme(page: Page, id: string) {
  await page.goto(`/#work-${id}`);
  await hydrated(page);
  return page.locator(`#work-${id}-case-study`);
}

test.describe('case study pages', () => {
  for (const study of caseStudies) {
    const path = caseStudyPath(study.id);

    test(`${path} renders the four parts, its metadata and its neighbours`, async ({
      page,
      request,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page).toHaveTitle(`${study.theme.title} — ${person.name}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(study.theme.title);
      for (const part of caseStudyParts) {
        await expect(
          page.locator(`section#${part.id}`).getByRole('heading', { level: 2 }),
        ).toHaveText(study.parts[part.id].title);
        await expect(
          page
            .getByRole('navigation', { name: 'On this page' })
            .getByRole('link', { name: part.label }),
        ).toHaveAttribute('href', `#${part.id}`);
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${site.url}${path}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        study.summary,
      );
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');

      const jsonLd = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
      );
      expect(jsonLd).toMatchObject({ '@type': 'Article', headline: study.theme.title });

      // The card is prerendered per case study; metadataBase makes its URL absolute to production.
      const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
      const { pathname, search } = new URL(og!);
      expect(pathname).toBe(`${path}/opengraph-image`);
      const image = await request.get(pathname + search);
      expect(image.status()).toBe(200);
      expect(image.headers()['content-type']).toBe('image/png');

      // The first and last case studies fill their missing neighbour with the way back.
      const pager = page.getByRole('navigation', { name: 'More case studies' });
      await expect(pager.getByRole('link', { name: /Back to Work/ })).toHaveCount(
        study === caseStudies[1] ? 0 : 1,
      );
      await expect(pager.locator('a[rel="prev"]')).toHaveCount(study === caseStudies[0] ? 0 : 1);
      await expect(pager.locator('a[rel="next"]')).toHaveCount(
        study === caseStudies.at(-1) ? 0 : 1,
      );
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} in ${colorScheme} has no serious or critical axe violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await hydrated(page);
        expect(await axeViolations(page)).toEqual([]);
      });
    }
  }

  test('logs no console errors on any case study or between them', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    for (const path of paths) {
      await page.goto(path);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
          scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });
      await page.waitForLoadState('networkidle');
    }
    // A duplicate view-transition-name would abort a transition and report an error here.
    await hydrated(page);
    await page.locator('a[rel="prev"]').click();
    await expect(page).toHaveURL(paths[1]!);
    await page.getByRole('link', { name: 'Back to Work' }).first().click();
    await expect(page).toHaveURL(/\/#work-mcp$/);
    expect(errors).toEqual([]);
  });

  test('an unknown case study is a 404, and /work leads to the Work section', async ({ page }) => {
    expect((await page.goto('/work/not-a-theme'))?.status()).toBe(404);
    await page.goto('/work');
    await expect(page).toHaveURL(/\/#work$/);
  });

  test('the sitemap and llms.txt list every case study', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const llms = await (await request.get('/llms.txt')).text();
    for (const path of paths) {
      expect(sitemap).toContain(`<loc>${site.url}${path}</loc>`);
      expect(llms).toContain(`(${site.url}${path})`);
    }
  });
});

test.describe('moving between the Work section and a case study', () => {
  test('the Work section links each theme to its case study', async ({ page }) => {
    await page.goto('/');
    for (const study of caseStudies) {
      await expect(
        page.getByRole('link', { name: `Read the case study: ${study.theme.title}` }),
      ).toHaveAttribute('href', caseStudyPath(study.id));
    }
  });

  test('the theme morphs into the case study and back, and focus follows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await recordMorphs(page);
    const link = await openTheme(page, 'mcp');

    await link.click();
    await expect(page).toHaveURL(caseStudyPath('mcp'));
    const shared = ['work-mcp-kicker', 'work-mcp-lede', 'work-mcp-title', 'work-mcp-visual'];
    await expect.poll(() => lastMorph(page)).toEqual(shared);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    await page.getByRole('link', { name: 'Back to Work' }).first().click();
    await expect(page).toHaveURL(/\/#work-mcp$/);
    await expect.poll(() => page.evaluate(() => window.__morphs?.length)).toBe(2);
    await expect.poll(() => lastMorph(page)).toEqual(shared);
    await expect(page.locator('#work-mcp-case-study')).toBeFocused();
    await expect(page.locator('#work-mcp-title')).toBeInViewport();
  });

  test('with reduced motion the pages swap without a morph', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await recordMorphs(page);
    const link = await openTheme(page, 'platform');

    await link.click();
    await expect(page).toHaveURL(caseStudyPath('platform'));
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    expect(await lastMorph(page)).toEqual([]);
  });

  test('the next case study’s title becomes its heading', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await recordMorphs(page);
    await page.goto(caseStudyPath('devtools'));
    await hydrated(page);

    await page.locator('a[rel="next"]').click();
    await expect(page).toHaveURL(caseStudyPath('mcp'));
    await expect.poll(() => lastMorph(page)).toEqual(['work-mcp-title']);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`Back to a case study returns focus to the card it was left by (${reducedMotion} motion)`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(caseStudyPath('devtools'));
      await hydrated(page);
      const card = page.locator('a[rel="next"]');
      const heading = page.getByRole('heading', { level: 1 });

      await card.click();
      await expect(page).toHaveURL(caseStudyPath('mcp'));
      await expect(heading).toBeFocused();

      // The browser restores the scroll position at the card, so focus is there too, not on the
      // heading far above it, and the next Tab carries on from where the reader is.
      await page.goBack();
      await expect(page).toHaveURL(caseStudyPath('devtools'));
      await expect(card).toBeFocused();
      await expect(card).toBeInViewport();
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeInViewport();
      await expect(heading).not.toBeInViewport();

      // Forward returns to the top of the next case study, where its heading takes focus.
      await page.goForward();
      await expect(page).toHaveURL(caseStudyPath('mcp'));
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
    });
  }

  test('by keyboard: Enter opens the case study, and Back returns to the link', async ({
    page,
  }) => {
    const link = await openTheme(page, 'devtools');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(caseStudyPath('devtools'));
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    // The next stop continues from the heading, inside the case study.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ask about this' })).toBeFocused();

    // Back and Forward swap pages instantly (React renders history traversals synchronously),
    // but focus still returns to the link that opened the case study, and stays there after the
    // browser scrolls to the fragment. Where it scrolls to is the browser's scroll restoration.
    await page.goBack();
    await expect(page).toHaveURL(/\/#work-devtools$/);
    await expect(link).toBeFocused();
    await page.waitForTimeout(500);
    await expect(link).toBeFocused();
  });
});
