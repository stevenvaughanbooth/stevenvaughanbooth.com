import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { accentText } from '@/components/ui/accent';
import { ArrowUpRight, Copy, GitHub, LinkedIn, Mail, Sparkle } from '@/components/ui/icons';
import type { AskMode } from '@/content/answers';
import { person } from '@/content/profile';
import { QUESTION_MAX } from '@/lib/ask-contract';
import { showOnPage } from '@/lib/page-actions';
import type { PageTargetId } from '@/lib/page-targets';
import type { AskOpenDetail } from './ask-events';
import { Close, Hash } from './ask-icons';
import { Conversation } from './conversation';
import type { LinkItem } from './palette-items';
import { type Option, search } from './search';
import { useAsk } from './use-ask';

export interface AskPaletteHandle {
  open(detail?: AskOpenDetail): void;
  close(): void;
  isOpen(): boolean;
}

const linkIcons: Record<LinkItem['id'], ReactNode> = {
  email: <Mail width={16} height={16} />,
  'copy-email': <Copy width={16} height={16} />,
  github: <GitHub width={16} height={16} />,
  linkedin: <LinkedIn width={16} height={16} />,
  adage: <GitHub width={16} height={16} />,
};

function statusLine(mode: AskMode, quota: { remaining: number; limit: number | null } | null) {
  switch (mode) {
    case 'checking':
      return { tone: 'bg-subtle', text: 'Checking live answers…' };
    case 'live': {
      const left = quota
        ? quota.limit
          ? `${quota.remaining} of ${quota.limit} questions left`
          : `${quota.remaining} questions left`
        : null;
      return {
        tone: 'bg-green',
        text: left ? `Live answers by Claude · ${left}` : 'Live answers by Claude',
      };
    }
    case 'exhausted':
      return { tone: 'bg-amber', text: 'Live questions used · topics still answer' };
    case 'curated':
      return { tone: 'bg-amber', text: 'Curated answers · live answers are off' };
  }
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid min-w-5 place-items-center rounded-md border border-line bg-elevated px-1 py-px font-mono text-micro leading-4 text-muted">
      {children}
    </kbd>
  );
}

interface AskPaletteProps {
  ref?: Ref<AskPaletteHandle>;
  /** Sends a message to the launcher's live region. */
  announce: (message: string) => void;
  /** Rendered inside the dialog: the launcher's live region, which must not be left outside it. */
  children?: ReactNode;
}

/** The Ask Steven command palette: search, curated topics, and live answers from Claude. */
export function AskPalette({ ref, announce, children }: AskPaletteProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const recall = useRef<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const ask = useAsk(announce, showTarget);
  const id = useId();

  const showResults = query.trim() !== '' || ask.turns.length === 0;
  const results = search(query);
  const active = showResults
    ? (results.options.find((option) => option.key === activeKey) ??
      results.options.find((option) => option.key === results.defaultKey) ??
      results.options[0])
    : undefined;
  const optionId = (key: string) => `${id}-option-${key.replace(/[^a-z0-9-]/gi, '-')}`;
  const status = statusLine(ask.mode, ask.quota);
  const askDisabled = ask.streaming && ask.mode !== 'curated' && ask.mode !== 'exhausted';

  function show(detail: AskOpenDetail = {}) {
    const element = dialog.current;
    if (!element) return;
    // "Show me the awards" from the hero moves the page straight there, without opening over it.
    if (!element.open && ask.navigate(detail.question ?? detail.prompt ?? '')) return;
    if (!element.open) element.showModal();
    input.current?.focus();
    input.current?.select();
    void ask.refresh();
    if (detail.prompt) {
      setQuery('');
      ask.run(detail.prompt);
    } else if (detail.question) {
      setQuery('');
      ask.ask(detail.question);
    }
  }

  function close() {
    dialog.current?.close();
  }

  /**
   * Closes the palette and shows a place on the site: scrolled to, focused and briefly
   * highlighted, or opened when it is a page of its own. After a live answer, only if the visitor
   * has not closed the palette in the meantime.
   */
  function showTarget(target: PageTargetId, afterAnswer: boolean) {
    if (afterAnswer && !dialog.current?.open) return;
    close();
    showOnPage(target, { navigate: (href) => router.push(href) });
  }

  useImperativeHandle(ref, () => ({
    open: show,
    close,
    isOpen: () => Boolean(dialog.current?.open),
  }));

  // Keep the active option visible while moving through the list with the keyboard.
  const activeId = active ? optionId(active.key) : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  // Bring the newest question into view when the conversation grows or reappears.
  const turnCount = ask.turns.length;
  useEffect(() => {
    if (showResults || turnCount === 0) return;
    const turns = body.current?.querySelectorAll('[data-turn]');
    turns?.[turns.length - 1]?.scrollIntoView?.({ block: 'start' });
  }, [turnCount, showResults]);

  function onClosed() {
    announce('');
    setQuery('');
    setActiveKey(null);
    recall.current = null;
  }

  function changeQuery(value: string) {
    setQuery(value);
    setActiveKey(null);
    recall.current = null;
  }

  function navigate(href: Route) {
    close();
    // Sections are page targets too, so a jump lands the same way an answer's "Show me" does.
    if (href.startsWith('/#') && showOnPage(href.slice(2), { navigate: (to) => router.push(to) })) {
      return;
    }
    if (href.startsWith('/#') && window.location.pathname === '/') {
      const target = document.getElementById(href.slice(2));
      if (target) {
        window.history.pushState(null, '', href);
        target.scrollIntoView({ block: 'start' });
        // Move focus with the view, so keyboard and screen reader users land in the section.
        const heading = target.querySelector<HTMLElement>('h2, h3') ?? target;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        return;
      }
    }
    router.push(href);
  }

  function openLink(href: string) {
    if (href.startsWith('mailto:')) {
      window.location.href = href;
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      announce('Email address copied.');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      announce(`Copy failed. The address is ${person.email}.`);
    }
  }

  function submit(text: string) {
    ask.ask(text);
    changeQuery('');
  }

  function activate(option: Option) {
    switch (option.kind) {
      case 'ask':
        if (!askDisabled) submit(option.query);
        return;
      case 'topic':
        ask.answerTopic(option.topic);
        changeQuery('');
        return;
      case 'go':
        navigate(option.item.href);
        return;
      case 'link':
        if (option.item.href) openLink(option.item.href);
        else void copyEmail();
        return;
    }
  }

  function move(to: 'next' | 'previous' | 'first' | 'last') {
    const { options } = results;
    if (options.length === 0) return;
    const index = active ? options.indexOf(active) : -1;
    const next =
      to === 'first'
        ? 0
        : to === 'last'
          ? options.length - 1
          : to === 'next'
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
    setActiveKey(options[next]?.key ?? null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    // In the conversation view, ↑ recalls earlier questions like a shell history.
    if (!showResults || recall.current !== null) {
      const questions = ask.turns.map((turn) => turn.question);
      if (event.key === 'ArrowUp' && questions.length > 0) {
        event.preventDefault();
        const index = Math.max(0, (recall.current ?? questions.length) - 1);
        recall.current = index;
        setQuery(questions[index] ?? '');
        return;
      }
      if (event.key === 'ArrowDown' && recall.current !== null) {
        event.preventDefault();
        const index = recall.current + 1;
        recall.current = index < questions.length ? index : null;
        setQuery(questions[index] ?? '');
        return;
      }
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => move('next'),
      ArrowUp: () => move('previous'),
      Home: () => move('first'),
      End: () => move('last'),
      Enter: () => active && activate(active),
      Escape: close,
    };
    const handler = keys[event.key];
    if (!handler || (!showResults && event.key !== 'Escape')) return;
    event.preventDefault();
    handler();
  }

  function optionContent(option: Option) {
    switch (option.kind) {
      case 'ask':
        return {
          icon: <Sparkle width={16} height={16} className="text-green" />,
          label: (
            <>
              {ask.mode === 'curated' || ask.mode === 'exhausted' ? 'Ask: ' : 'Ask Claude: '}
              <span className="text-muted">“{option.query}”</span>
            </>
          ),
          meta: askDisabled
            ? 'Answering…'
            : ask.mode === 'curated'
              ? 'Curated answer'
              : ask.mode === 'exhausted'
                ? 'Live questions used'
                : ask.quota
                  ? `${ask.quota.remaining}${ask.quota.limit ? ` of ${ask.quota.limit}` : ''} left`
                  : null,
        };
      case 'topic':
        return {
          icon: (
            <span
              className={`font-mono text-[1.15rem] leading-none ${option.topic.accent ? accentText[option.topic.accent] : 'text-muted'}`}
            >
              {option.topic.glyph}
            </span>
          ),
          label: option.topic.title,
          meta: option.topic.hint,
        };
      case 'go':
        return {
          icon: <Hash width={15} height={15} />,
          label: option.item.label,
          meta: option.item.href.replace(/^\//, ''),
        };
      case 'link':
        return {
          icon: linkIcons[option.item.id],
          label: (
            <>
              {option.item.id === 'copy-email' && copied
                ? 'Copied to clipboard'
                : option.item.label}
              {option.item.href?.startsWith('https://') ? (
                <ArrowUpRight width={14} height={14} className="ml-1 inline text-subtle" />
              ) : null}
            </>
          ),
          meta: option.item.hint,
        };
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Ask Steven"
      onClose={onClosed}
      onPointerDown={(event) => {
        // A press on the backdrop (outside the panel) dismisses the palette.
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-surface p-0 text-fg transition-[opacity,translate,scale] duration-300 ease-out-expo backdrop:bg-bg/70 backdrop:backdrop-blur-[3px] motion-reduce:transition-none sm:mx-auto sm:mt-[min(12vh,7rem)] sm:h-[min(38rem,calc(100dvh-min(12vh,7rem)-2rem))] sm:w-[min(42rem,calc(100%-2rem))] sm:rounded-2xl sm:border sm:border-line-strong sm:shadow-card starting:translate-y-4 starting:opacity-0 sm:starting:translate-y-0 sm:starting:scale-[0.98]"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 focus-within:shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--green)_55%,transparent)] sm:px-5 forced-colors:focus-within:outline-2 forced-colors:focus-within:-outline-offset-2 forced-colors:focus-within:outline-[Highlight]">
          <Sparkle width={18} height={18} className="shrink-0 text-green" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Ask a question or search"
            aria-expanded={showResults}
            aria-controls={showResults ? `${id}-listbox` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={QUESTION_MAX}
            value={query}
            placeholder={
              ask.turns.length > 0 ? 'Ask a follow-up, or search…' : 'Ask a question, or jump to…'
            }
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle focus-visible:outline-none sm:text-[1.05rem]"
          />
          <button
            type="button"
            onClick={close}
            className="grid h-8 shrink-0 place-items-center rounded-lg px-2 text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            <span className="sr-only">Close</span>
            <span aria-hidden className="hidden sm:inline-flex">
              <Kbd>esc</Kbd>
            </span>
            <Close className="sm:hidden" />
          </button>
        </div>

        <div
          ref={body}
          // Focusable so keyboard users can scroll long answers with the arrow and page keys.
          tabIndex={0}
          aria-label={showResults ? 'Search results' : 'Conversation'}
          role="region"
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px]"
        >
          {showResults ? (
            <div id={`${id}-listbox`} role="listbox" aria-label="Results" className="p-2 pb-3">
              {results.groups.map((group) => (
                <div key={group.id} role="group" aria-labelledby={`${id}-group-${group.id}`}>
                  <div
                    id={`${id}-group-${group.id}`}
                    aria-hidden
                    className="label px-3 pt-3 pb-1.5"
                  >
                    {group.label}
                  </div>
                  {group.options.map((option) => {
                    const { icon, label, meta } = optionContent(option);
                    const selected = option.key === active?.key;
                    const disabled = option.kind === 'ask' && askDisabled;
                    return (
                      <div
                        key={option.key}
                        id={optionId(option.key)}
                        role="option"
                        aria-selected={selected}
                        aria-disabled={disabled || undefined}
                        onPointerMove={() => {
                          if (!selected) setActiveKey(option.key);
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => activate(option)}
                        // The active option has a solid accent bar (not only a tint) and, in forced
                        // colors, a Highlight outline, so it never depends on color alone.
                        className={`group/option relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-100 ${selected ? 'bg-elevated forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-[Highlight]' : ''} ${disabled ? 'cursor-default opacity-60' : ''}`}
                      >
                        {selected ? (
                          <span
                            aria-hidden
                            className="absolute top-2 bottom-2 left-0 rounded-full border-l-[3px] border-green"
                          />
                        ) : null}
                        <span
                          aria-hidden
                          className={`grid size-8 shrink-0 place-items-center rounded-lg border transition-colors ${selected ? 'border-line-strong bg-surface text-fg' : 'border-line bg-bg text-muted'}`}
                        >
                          {icon}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                          <span className="truncate text-fg">{label}</span>{' '}
                          {meta ? (
                            <span
                              className={`truncate font-mono text-xs sm:ml-auto sm:max-w-[45%] sm:shrink-0 ${selected ? 'text-muted' : 'text-subtle'}`}
                            >
                              {meta}
                            </span>
                          ) : null}
                        </span>
                        <span
                          aria-hidden
                          className={`hidden shrink-0 sm:block ${selected ? 'visible' : 'invisible'}`}
                        >
                          <Kbd>↵</Kbd>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <Conversation
              idPrefix={id}
              turns={ask.turns}
              pathname={pathname}
              copied={copied}
              onNavigate={navigate}
              onShow={(target) => showTarget(target, false)}
              onTopic={(topic) => ask.answerTopic(topic)}
              onRetry={ask.retry}
              onCopyEmail={() => void copyEmail()}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-subtle sm:px-5">
          <p className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full ${status.tone} ${ask.streaming ? 'motion-safe:animate-pulse' : ''}`}
            />
            <span className="truncate">{ask.streaming ? 'Claude is answering…' : status.text}</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {ask.turns.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  ask.clear();
                  input.current?.focus();
                }}
                className="rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                Clear
              </button>
            ) : null}
            <span aria-hidden className="hidden items-center gap-1.5 md:flex">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span className="mr-1.5">move</span>
              <Kbd>↵</Kbd>
              <span>select</span>
            </span>
          </div>
        </div>
      </div>
      {children}
    </dialog>
  );
}
