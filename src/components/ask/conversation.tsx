import type { Route } from 'next';
import { type MouseEvent, useId } from 'react';
import { accentText } from '@/components/ui/accent';
import { ArrowUpRight, Check, Copy, Mail, Sparkle } from '@/components/ui/icons';
import { type AnswerLink, type Topic, topicById } from '@/content/answers';
import { person } from '@/content/profile';
import { actionsOn, type PageTargetId, pageTarget } from '@/lib/page-targets';
import { Retry } from './ask-icons';
import { Locate } from './locate-icon';
import type { Notice, Turn } from './use-ask';

interface ConversationProps {
  idPrefix: string;
  turns: Turn[];
  /** The page behind the palette, which decides what an answer's places offer. */
  pathname: string;
  copied: boolean;
  onNavigate: (href: Route) => void;
  /** Shows a place on the site; the palette closes first. */
  onShow: (target: PageTargetId) => void;
  onTopic: (topic: Topic) => void;
  onRetry: (id: number) => void;
  onCopyEmail: () => void;
}

/** Live answers are plain text: drop stray Markdown emphasis and headings, never parse HTML. */
function paragraphsOf(text: string): string[] {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function quotaText(quota: NonNullable<Turn['quota']>): string {
  if (quota.remaining === 0) return 'no live questions left';
  const noun = quota.remaining === 1 ? 'question' : 'questions';
  return quota.limit
    ? `${quota.remaining} of ${quota.limit} ${noun} left`
    : `${quota.remaining} ${noun} left`;
}

function isModified(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

const chip =
  'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg transition-colors hover:border-line-strong hover:bg-elevated';

const isRoute = (href: AnswerLink['href']): href is Route => href.startsWith('/');

function LinkChip({ link, onNavigate }: { link: AnswerLink; onNavigate: (href: Route) => void }) {
  const { href } = link;
  const internal = isRoute(href);
  const external = href.startsWith('https://');
  return (
    <a
      href={href}
      className={chip}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={(event) => {
        if (!isRoute(href) || isModified(event)) return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {href.startsWith('mailto:') ? <Mail width={14} height={14} /> : null}
      {link.label}
      {external ? (
        <>
          <ArrowUpRight width={14} height={14} className="text-subtle" />
          <span className="sr-only">(opens in a new tab)</span>
        </>
      ) : null}
      {internal ? (
        <span aria-hidden className="text-subtle">
          →
        </span>
      ) : null}
    </a>
  );
}

/**
 * The places an answer points to. "Show me" buttons stay on this page, the first as the main
 * action; a case study is another page, so it is a link (a modified click opens it in a new tab).
 * Nothing here moves the page until it is pressed.
 */
function Actions({
  actions,
  onShow,
}: {
  actions: readonly PageTargetId[];
  onShow: (target: PageTargetId) => void;
}) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="On this site">
      {actions.map((id, index) => {
        const target = pageTarget(id);
        if (!target) return null;
        return (
          <li key={id}>
            {target.kind === 'case-study' ? (
              <a
                href={target.href}
                className="pill pill-outline pill-sm"
                onClick={(event) => {
                  if (isModified(event)) return;
                  event.preventDefault();
                  onShow(id);
                }}
              >
                Read {target.label}
                <span aria-hidden className="text-subtle">
                  →
                </span>
              </a>
            ) : (
              <button
                type="button"
                className={`pill pill-sm ${index === 0 ? 'pill-solid' : 'pill-outline'}`}
                onClick={() => onShow(id)}
              >
                <Locate width={16} height={16} />
                Show me {target.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NoticeLine({ notice }: { notice: Notice }) {
  const text =
    notice.kind === 'curated-mode'
      ? 'Live answers are off right now, so this comes from Steven’s curated notes.'
      : notice.kind === 'fallback' || notice.kind === 'busy'
        ? 'Claude couldn’t answer that just now, so here’s what Steven’s notes say.'
        : null;
  if (!text) return null;
  return (
    <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-subtle">
      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber" />
      {text}
    </p>
  );
}

function ExhaustedCard({ copied, onCopyEmail }: { copied: boolean; onCopyEmail: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-elevated p-4 sm:p-5">
      <p className="font-medium text-fg">That’s all the live questions for now.</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Thanks for exploring. Anything else is best asked directly: Steven is one email away. Preset
        topics still answer instantly.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={person.links.email}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-fg px-4 text-sm font-medium text-bg transition-transform hover:-translate-y-0.5"
        >
          <Mail width={16} height={16} /> Email Steven
        </a>
        <button
          type="button"
          onClick={onCopyEmail}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium transition-colors hover:bg-bg"
        >
          {copied ? (
            <Check width={16} height={16} className="text-green" />
          ) : (
            <Copy width={16} height={16} />
          )}
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </div>
      <p className="mt-3 font-mono text-xs break-all text-muted">{person.email}</p>
    </div>
  );
}

function BusyCard({ retryAfter, onRetry }: { retryAfter: number | null; onRetry: () => void }) {
  // Busy only ever means the one-minute burst limit, so the wait is short.
  const wait =
    retryAfter && retryAfter > 1 && retryAfter < 120
      ? `Try again in about ${retryAfter} seconds.`
      : 'Try again in a moment.';
  return (
    <div className="mt-4 rounded-2xl border border-line bg-elevated p-4">
      <p className="font-medium text-fg">Claude is busy right now.</p>
      <p className="mt-1 text-sm text-muted">Lots of questions at once. {wait}</p>
      <button type="button" onClick={onRetry} className={`${chip} mt-3`}>
        <Retry width={14} height={14} /> Try again
      </button>
    </div>
  );
}

function TopicChips({
  label,
  topics,
  onTopic,
}: {
  label: string;
  topics: Topic[];
  onTopic: (topic: Topic) => void;
}) {
  const id = useId();
  return (
    <div className="mt-5">
      <p id={id} className="label">
        {label}
      </p>
      <ul aria-labelledby={id} className="mt-2 flex flex-wrap gap-2">
        {topics.map((topic) => (
          <li key={topic.id}>
            <button type="button" className={chip} onClick={() => onTopic(topic)}>
              <span
                aria-hidden
                className={`font-mono text-sm leading-none ${topic.accent ? accentText[topic.accent] : 'text-muted'}`}
              >
                {topic.glyph}
              </span>
              {topic.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[0.45em] translate-y-[0.18em] rounded-[1px] bg-green motion-safe:animate-pulse"
    />
  );
}

function TurnView({
  turn,
  latest,
  headingId,
  pathname,
  copied,
  onNavigate,
  onShow,
  onTopic,
  onRetry,
  onCopyEmail,
}: {
  turn: Turn;
  latest: boolean;
  headingId: string;
} & Omit<ConversationProps, 'turns' | 'idPrefix'>) {
  const { answer, notice } = turn;
  const live = turn.source === 'live';
  const paragraphs = live ? paragraphsOf(turn.text) : (answer?.paragraphs ?? []);
  const actions = actionsOn(
    live ? (turn.streaming ? [] : (turn.actions ?? [])) : (answer?.actions ?? []),
    pathname,
  );

  return (
    <article aria-labelledby={headingId} data-turn={turn.id} className="scroll-mt-4">
      <h2 id={headingId} className="flex gap-2.5 text-[0.95rem] leading-snug font-medium text-fg">
        <span aria-hidden className="font-mono text-green">
          ›
        </span>
        <span className="min-w-0 break-words">{turn.question}</span>
      </h2>

      <div className="mt-3 pl-[1.15rem]">
        {notice && answer ? <NoticeLine notice={notice} /> : null}

        {answer?.heading && !live ? (
          <p className="mt-2 font-semibold text-balance text-fg">{answer.heading}</p>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="mt-2 space-y-3 text-[0.95rem] leading-relaxed text-pretty text-muted">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="break-words whitespace-pre-line">
                {paragraph}
                {turn.streaming && index === paragraphs.length - 1 ? <Caret /> : null}
              </p>
            ))}
          </div>
        ) : turn.streaming ? (
          <p className="mt-2 text-[0.95rem] text-subtle">
            Asking Claude
            <Caret />
          </p>
        ) : null}

        {notice?.kind === 'interrupted' ? (
          <p className="mt-3 text-xs text-subtle">The answer was cut off. Try asking again.</p>
        ) : null}

        {!live && answer?.facts ? (
          <dl className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
            {answer.facts.map((fact) => (
              <div
                key={fact.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2"
              >
                <dt className="font-mono text-xs text-subtle">{fact.label}</dt>
                <dd className="break-words text-fg">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {actions.length > 0 ? <Actions actions={actions} onShow={onShow} /> : null}

        {!live && answer?.links?.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Related links">
            {answer.links.map((link) => (
              <li key={link.href}>
                <LinkChip link={link} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : null}

        {notice?.kind === 'exhausted' ? (
          <ExhaustedCard copied={copied} onCopyEmail={onCopyEmail} />
        ) : null}
        {notice?.kind === 'busy' ? (
          <BusyCard retryAfter={notice.retryAfter} onRetry={() => onRetry(turn.id)} />
        ) : null}

        {turn.suggestions?.length ? (
          <TopicChips label="Did you mean" topics={turn.suggestions} onTopic={onTopic} />
        ) : latest && !live && answer?.followUps?.length ? (
          <TopicChips
            label="Keep exploring"
            topics={answer.followUps.map(topicById)}
            onTopic={onTopic}
          />
        ) : null}

        {live && turn.text ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-subtle">
            <Sparkle width={14} height={14} className="text-green" />
            Answered by Claude from Steven’s public profile
            {turn.quota ? <span>· {quotaText(turn.quota)}</span> : null}
          </p>
        ) : answer ? (
          <p className="mt-4 text-xs text-subtle">From Steven’s curated notes</p>
        ) : null}
      </div>
    </article>
  );
}

export function Conversation({ idPrefix, turns, ...handlers }: ConversationProps) {
  return (
    <div className="space-y-8 px-4 py-5 sm:px-6 sm:py-6">
      {turns.map((turn, index) => (
        <TurnView
          key={turn.id}
          turn={turn}
          latest={index === turns.length - 1}
          headingId={`${idPrefix}-turn-${turn.id}`}
          {...handlers}
        />
      ))}
    </div>
  );
}
