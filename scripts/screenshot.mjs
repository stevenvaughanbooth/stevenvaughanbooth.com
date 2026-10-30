// Dev helper: capture a page with Playwright for visual review.
// Usage: node scripts/screenshot.mjs <url> <out.png> [width=1440] [height=900] [light|dark] [full=true] [selector]
// Reduced motion is emulated so scroll-driven reveals render without scrolling.
import { chromium } from '@playwright/test';

const [, , url, out, width = '1440', height = '900', scheme = 'dark', full = 'true', selector] =
  process.argv;
if (!url || !out) {
  console.error(
    'Usage: node scripts/screenshot.mjs <url> <out.png> [w] [h] [light|dark] [full] [selector]',
  );
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: scheme === 'light' ? 'light' : 'dark',
  reducedMotion: 'reduce',
});
await page.goto(url, { waitUntil: 'networkidle' });
if (selector) await page.locator(selector).first().screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: full === 'true' });
await browser.close();
console.log(`Saved ${out}`);
