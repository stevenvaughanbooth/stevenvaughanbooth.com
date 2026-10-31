import Link from 'next/link';
import { type SectionId, sections } from '@/content/profile';
import { AskButton } from './ask/ask-button';
import { AskShortcut } from './ask/ask-shortcut';
import { MobileNav } from './mobile-nav';
import { readingStyle } from './reading';
import styles from './reading.module.css';
import { Shortcuts } from './shortcuts/shortcuts';
import { ThemeToggle } from './theme-toggle';
import { Moon, Sun } from './ui/icons';
import { XrayToggle } from './xray/xray-toggle';

export interface NavItem {
  id: SectionId;
  label: string;
}

const nav: NavItem[] = sections
  .filter((section) => section.nav)
  .map(({ id, label }) => ({ id, label }));

export function SiteHeader() {
  return (
    <>
      <header
        data-component="site-header"
        className="site-header fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="page flex h-16 items-center gap-6">
          {/* No prefetch: on the home page it would download the page already on screen. */}
          <Link href="/" prefetch={false} className="font-mono text-lg font-medium tracking-tight">
            <span aria-hidden>
              sb<span className="text-green">.</span>
            </span>
            <span className="sr-only">Steven Booth, home</span>
          </Link>
          <nav aria-label="Primary" className="hidden flex-1 self-stretch md:flex">
            <ul className="flex gap-1">
              {nav.map((item) => (
                <li
                  key={item.id}
                  className={`${styles.item} relative flex items-center`}
                  style={readingStyle(item.id)}
                >
                  {/*
                   * Plain anchors, not next/link: the browser's own fragment navigation scrolls to
                   * the section and moves the focus starting point into it, so the next Tab
                   * continues there. From another page they load the home page at that section.
                   */}
                  <a
                    href={`/#${item.id}`}
                    className={`${styles.link} rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-fg`}
                  >
                    {item.label}
                  </a>
                  {/* Marks the section being read; decorative, so it adds nothing to the link. */}
                  <span
                    aria-hidden
                    className={`${styles.marker} absolute -inset-x-0.75 -bottom-px h-0.5 bg-green forced-colors:bg-[Highlight]`}
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <AskButton
              aria-keyshortcuts="Meta+K Control+K"
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-3.5 pl-3.5 text-sm text-muted shadow-card transition-colors hover:border-line-strong hover:text-fg sm:pr-1.5"
            >
              Ask Steven
              <kbd
                aria-hidden
                className="hidden rounded-full bg-elevated px-2 py-0.5 font-mono text-micro text-muted group-hover:text-fg sm:inline-block"
              >
                <AskShortcut />
              </kbd>
            </AskButton>
            <ThemeToggle>
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </ThemeToggle>
            <XrayToggle />
            {/* Section menu for small screens, on the native Popover API. */}
            <button
              type="button"
              popoverTarget="mobile-nav"
              data-component="sections-menu"
              aria-label="Sections"
              className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg md:hidden"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
            <div
              id="mobile-nav"
              popover="auto"
              className="inset-auto top-[4.5rem] right-3 left-3 m-0 w-auto rounded-2xl border border-line bg-surface p-2 text-fg shadow-card"
            >
              <MobileNav>
                <ul>
                  {nav.map((item) => (
                    <li key={item.id} className={styles.item} style={readingStyle(item.id)}>
                      <a
                        href={`/#${item.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-base transition-colors hover:bg-elevated"
                      >
                        {item.label}
                        {/* Marks the section being read (reading.module.css); decorative. */}
                        <span
                          aria-hidden
                          className={`${styles.dot} size-1.5 rounded-full bg-green forced-colors:bg-[Highlight]`}
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </MobileNav>
            </div>
          </div>
        </div>
      </header>
      {/* Outside the banner landmark: the sheet it loads is a page-level dialog. */}
      <Shortcuts />
    </>
  );
}
