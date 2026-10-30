import { useRef, useState } from 'react';
import {
  answerFor,
  type AskMode,
  type CuratedAnswer,
  matchQuestion,
  type Topic,
  topicById,
} from '@/content/answers';
import { HISTORY_MAX_ITEMS, QUESTION_MAX } from '@/lib/ask-contract';
import { askClaude, getAskStatus } from '@/lib/ask-client';

export type Notice =
  | { kind: 'curated-mode' }
  | { kind: 'fallback' }
  | { kind: 'exhausted' }
  | { kind: 'busy'; retryAfter: number | null }
  | { kind: 'interrupted' };

export interface Turn {
  id: number;
  question: string;
  source: 'curated' | 'live';
  /** Curated answers render from data; live answers are plain text. */
  answer?: CuratedAnswer;
  /** Topics the question touched on without matching any, offered as "Did you mean…". */
  suggestions?: Topic[];
  text: string;
  streaming: boolean;
  notice?: Notice;
  /** Allowance reported with this live answer. */
  quota?: { remaining: number; limit: number | null };
}

type Status =
  | { state: 'unknown' }
  | { state: 'offline' }
  | { state: 'ready'; enabled: boolean; limit: number | null; remaining: number };

const MAX_TURNS = 20;
const STATUS_TTL_MS = 30_000;

/** The visitor's earlier questions, oldest first, for follow-up context. Never the answers. */
export function historyFrom(turns: Turn[]): string[] {
  return turns
    .filter((turn) => !turn.streaming)
    .slice(-HISTORY_MAX_ITEMS)
    .map((turn) => turn.question);
}

function clean(question: string): string {
  return question.replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);
}

function spoken(answer: CuratedAnswer | undefined): string {
  return answer ? [answer.heading, ...answer.paragraphs].filter(Boolean).join(' ') : '';
}

/**
 * The palette's conversation state. `announce` sends a message to the launcher's live region,
 * which owns the timing.
 */
export function useAsk(announce: (message: string) => void) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Status>({ state: 'unknown' });
  const nextId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const checkedAt = useRef(0);

  const mode: AskMode =
    status.state === 'unknown'
      ? 'checking'
      : status.state === 'offline' || !status.enabled
        ? 'curated'
        : status.remaining <= 0
          ? 'exhausted'
          : 'live';
  const quota =
    status.state === 'ready' ? { remaining: status.remaining, limit: status.limit } : null;
  const streaming = turns.some((turn) => turn.streaming);

  function addTurn(turn: Omit<Turn, 'id'>): number {
    nextId.current += 1;
    const id = nextId.current;
    setTurns((previous) => [...previous.slice(-(MAX_TURNS - 1)), { ...turn, id }]);
    return id;
  }

  function patch(id: number, update: Partial<Turn>) {
    setTurns((previous) =>
      previous.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)),
    );
  }

  function announceAnswer(turn: Pick<Turn, 'answer' | 'notice'>) {
    const parts = [spoken(turn.answer)];
    if (turn.notice?.kind === 'exhausted') {
      parts.push('Live questions are used up. Email Steven to keep the conversation going.');
    } else if (turn.notice?.kind === 'busy') {
      parts.push('Claude is busy right now. Try again shortly.');
    }
    announce(parts.filter(Boolean).join(' '));
  }

  /**
   * The curated reply to a question: a confident topic, or else the near misses as suggestions,
   * under the fallback answer or, when a card already explains why Claude did not answer (used
   * up, busy), under that card alone.
   */
  function curatedReply(question: string, notice: Notice) {
    // A notice can say more than the last status check: a 503 means live answers are off now.
    const now: AskMode =
      notice.kind === 'curated-mode' ? 'curated' : notice.kind === 'exhausted' ? 'exhausted' : mode;
    const match = matchQuestion(question);
    if (match.kind !== 'none') return { answer: answerFor(match.answer, now), notice };
    const card = notice.kind === 'exhausted' || notice.kind === 'busy';
    return {
      answer: card ? undefined : answerFor(match.answer, now),
      suggestions: match.suggestions.length > 0 ? match.suggestions.map(topicById) : undefined,
      notice,
    };
  }

  function curated(question: string, reply: Pick<Turn, 'answer' | 'suggestions' | 'notice'>) {
    addTurn({ question, source: 'curated', text: '', streaming: false, ...reply });
    announceAnswer(reply);
  }

  async function refresh() {
    if (streaming || Date.now() - checkedAt.current < STATUS_TTL_MS) return;
    checkedAt.current = Date.now();
    const next = await getAskStatus();
    setStatus(next ? { state: 'ready', ...next } : { state: 'offline' });
  }

  /** Settles a live turn from curated notes when Claude cannot answer it. */
  function settleCurated(id: number, question: string, notice: Notice) {
    const reply = curatedReply(question, notice);
    patch(id, { source: 'curated', streaming: false, text: '', ...reply });
    announceAnswer(reply);
  }

  async function live(question: string, reuseId?: number) {
    const before = reuseId
      ? turns.slice(
          0,
          turns.findIndex((turn) => turn.id === reuseId),
        )
      : turns;
    const history = historyFrom(before);
    const id = reuseId ?? addTurn({ question, source: 'live', text: '', streaming: true });
    if (reuseId) {
      patch(id, {
        source: 'live',
        text: '',
        streaming: true,
        answer: undefined,
        suggestions: undefined,
        notice: undefined,
      });
    }
    announce('Claude is answering.');

    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;

    try {
      const outcome = await askClaude(question, history, current.signal);
      switch (outcome.kind) {
        case 'stream': {
          const { remaining, limit } = outcome;
          if (remaining !== null) {
            setStatus((previous) => ({
              state: 'ready',
              enabled: true,
              remaining,
              limit: limit ?? (previous.state === 'ready' ? previous.limit : null),
            }));
            patch(id, { quota: { remaining, limit } });
          }
          let text = '';
          try {
            for await (const chunk of outcome.chunks) {
              text += chunk;
              patch(id, { text });
            }
          } catch {
            if (current.signal.aborted) return;
            if (!text.trim()) return settleCurated(id, question, { kind: 'fallback' });
            patch(id, { streaming: false, notice: { kind: 'interrupted' } });
            announce(`${text} The answer was cut off.`);
            return;
          }
          if (!text.trim()) return settleCurated(id, question, { kind: 'fallback' });
          patch(id, { streaming: false });
          announce(text);
          return;
        }
        case 'limit_reached':
          setStatus((previous) => ({
            state: 'ready',
            enabled: true,
            remaining: 0,
            limit: previous.state === 'ready' ? previous.limit : null,
          }));
          return settleCurated(id, question, { kind: 'exhausted' });
        case 'busy':
          // Only the one-minute burst limit says busy; curated notes still answer meanwhile.
          return settleCurated(id, question, { kind: 'busy', retryAfter: outcome.retryAfter });
        case 'unavailable':
          setStatus({ state: 'offline' });
          return settleCurated(id, question, { kind: 'curated-mode' });
        case 'fallback':
          return settleCurated(id, question, { kind: 'fallback' });
      }
    } catch {
      if (!current.signal.aborted) settleCurated(id, question, { kind: 'fallback' });
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }

  /** Free-form text typed by the visitor. Only questions curated notes cannot settle reach Claude. */
  function ask(raw: string) {
    const question = clean(raw);
    if (!question) return;
    const match = matchQuestion(question);
    // Help, refusals, the prompt link and exact topic questions never need a model.
    const local = match.kind === 'topic' ? match.exact : match.kind !== 'none';
    if (local) return curated(question, { answer: answerFor(match.answer, mode) });
    if (mode === 'curated')
      return curated(question, curatedReply(question, { kind: 'curated-mode' }));
    if (mode === 'exhausted')
      return curated(question, curatedReply(question, { kind: 'exhausted' }));
    void live(question);
  }

  /** A suggested prompt (from an "Ask about this" button): curated topics first, then Claude. */
  function run(raw: string) {
    const question = clean(raw);
    if (!question) return;
    const last = turns.at(-1);
    if (last && last.question === question && !last.notice) return;
    const match = matchQuestion(question);
    if (match.kind === 'none') return ask(question);
    curated(question, { answer: answerFor(match.answer, mode) });
  }

  function answerTopic(topic: Topic) {
    curated(topic.prompt, { answer: answerFor(topic, mode) });
  }

  function retry(id: number) {
    const turn = turns.find((candidate) => candidate.id === id);
    if (!turn || streaming) return;
    if (mode === 'live' || mode === 'checking') void live(turn.question, id);
    else
      settleCurated(id, turn.question, {
        kind: mode === 'exhausted' ? 'exhausted' : 'curated-mode',
      });
  }

  function clear() {
    controller.current?.abort();
    controller.current = null;
    setTurns([]);
    announce('Conversation cleared.');
  }

  return {
    turns,
    mode,
    quota,
    streaming,
    refresh,
    ask,
    run,
    answerTopic,
    retry,
    clear,
  };
}
