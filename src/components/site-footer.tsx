import Link from 'next/link';
import { disclaimer, person, site } from '@/content/profile';
import { ShortcutsButton } from './shortcuts/shortcuts';

export function SiteFooter() {
  return (
    <footer data-component="site-footer" className="border-t border-line">
      <div className="page flex flex-col gap-8 py-12 text-sm text-muted md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-3">
          <p className="font-mono text-fg">
            sb<span className="text-green">.</span>
          </p>
          <p className="text-xs leading-relaxed text-subtle">{disclaimer}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5">
            <li>
              <Link href="/colophon" prefetch={false} className="hover:text-fg">
                Under the hood
              </Link>
            </li>
            <li>
              <a href={site.repo} className="hover:text-fg">
                Source on GitHub
              </a>
            </li>
            <li>
              <a href="/profile.json" className="hover:text-fg">
                profile.json
              </a>
            </li>
            <li>
              <a href="/llms.txt" className="hover:text-fg">
                llms.txt
              </a>
            </li>
            <li>
              <a href={person.links.github} className="hover:text-fg">
                GitHub
              </a>
            </li>
            <li>
              <a href={person.links.linkedin} className="hover:text-fg">
                LinkedIn
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="page flex items-center justify-between gap-4 border-t border-line py-6 text-xs text-subtle">
        <span>© {person.name}</span>
        <span className="flex items-center gap-5">
          <ShortcutsButton className="group hidden min-h-6 items-center gap-2 transition-colors hover:text-fg sm:inline-flex">
            Keyboard shortcuts
            <kbd
              aria-hidden
              className="inline-grid size-5 place-items-center rounded-md border border-line bg-elevated font-mono text-micro text-muted group-hover:text-fg"
            >
              ?
            </kbd>
          </ShortcutsButton>
          <span>{site.domain}</span>
        </span>
      </div>
    </footer>
  );
}
