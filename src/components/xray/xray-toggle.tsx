import { site } from '@/content/profile';
import pkg from '../../../package.json';
import ear from './ear.module.css';

/**
 * What the HUD says about the build, written into the HTML as the page is prerendered: the
 * repository, the React and Next.js versions, and the commit Vercel deployed (absent locally).
 */
const build = JSON.stringify({
  repo: site.repo,
  react: pkg.dependencies.react,
  next: pkg.dependencies.next,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
});

/**
 * X-ray this page: turns X-ray mode on and off, peeling the page back into a blueprint of its
 * components. A Server Component with no JavaScript of its own: like any <button
 * data-xray-toggle>, its presses reach the shortcuts listener (shortcuts/shortcuts.tsx), which
 * loads X-ray on intent, and X-ray keeps its aria-pressed in step. The page starts unpeeled.
 */
export function XrayToggle() {
  return (
    <button
      type="button"
      id="xray-toggle"
      data-xray-toggle
      data-component="xray-toggle"
      data-xray-build={build}
      aria-label="X-ray this page"
      aria-pressed="false"
      // Dropped while single keys are off (shortcuts/keys.ts).
      data-keyshortcut="X"
      aria-keyshortcuts="X"
      title="X-ray this page"
      className="group grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg aria-pressed:text-fg"
    >
      {/* A page with its corner folded back over code; the corner lifts a little on hover. */}
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14 3.75H6.5a1.75 1.75 0 0 0-1.75 1.75v13a1.75 1.75 0 0 0 1.75 1.75h11a1.75 1.75 0 0 0 1.75-1.75V9Z" />
        <path
          d="M14 3.75V7.5A1.5 1.5 0 0 0 15.5 9h3.75"
          className="origin-top-right transition-transform [transform-box:fill-box] motion-safe:group-hover:scale-125"
        />
        <path d="m9.25 12.75-1.5 1.75 1.5 1.75M14.75 12.75l1.5 1.75-1.5 1.75M12.6 12.25l-1.2 4.5" />
      </svg>
    </button>
  );
}

/**
 * The dog-ear: the page's top-right corner, turned down a little over the blueprint underneath,
 * to pull back by hand. Pressing it captures the pointer (shortcuts/shortcuts.tsx), and dragging
 * it peels the page (xray.tsx). It repeats the toggle above for pointers, so it is hidden from
 * assistive technology and takes no focus; keyboards have the toggle and X. It shows only where
 * the peel can run, never under reduced motion, and goes while X-ray is on.
 */
export function XrayEar() {
  return (
    <div data-xray-ear aria-hidden className={ear.ear}>
      <span className={ear.hint}>Drag to peel back</span>
    </div>
  );
}
