import Link from 'next/link';
import { type SectionId, sections } from '@/content/profile';
import { AskButton } from './ask/ask-button';
import { AskShortcut } from './ask/ask-shortcut';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';
import { Moon, Sun } from './ui/icons';

export interface NavItem {
  id: SectionId;
  label: string;
}

const nav: NavItem[] = sections
  .filter((section) => section.nav)
  .map(({ id, label }) => ({ id, label }));

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/70 bg-bg/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="page flex h-16 items-center gap-6">
        {/* No prefetch: on the home page it would download the page already on screen. */}
        <Link href="/" prefetch={false} className="font-mono text-lg font-medium tracking-tight">
          <span aria-hidden>
            sb<span className="text-green">.</span>
          </span>
          <span className="sr-only">Steven Booth, home</span>
        </Link>
        <nav aria-label="Primary" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.id}>
                {/*
                 * Plain anchors, not next/link: the browser's own fragment navigation scrolls to
                 * the section and moves the focus starting point into it, so the next Tab
                 * continues there. From another page they load the home page at that section.
                 */}
                <a
                  href={`/#${item.id}`}
                  className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                >
                  {item.label}
                </a>
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
          <MobileNav items={nav} />
        </div>
      </div>
    </header>
  );
}
