import Link from 'next/link';
import { disclaimer, person, site } from '@/content/profile';

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
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
              <Link href="/colophon" className="hover:text-fg">
                How this site is built
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
      <div className="page flex justify-between border-t border-line py-6 text-xs text-subtle">
        <span>© {person.name}</span>
        <span>{site.domain}</span>
      </div>
    </footer>
  );
}
