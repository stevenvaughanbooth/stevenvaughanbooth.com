import {
  featuredTopicIds,
  keywordScore,
  normalize,
  type Topic,
  topicById,
  topics,
} from '@/content/answers';
import { type GoToItem, goToItems, type LinkItem, linkItems } from './palette-items';

export type Option =
  | { key: 'ask'; kind: 'ask'; query: string }
  | { key: string; kind: 'topic'; topic: Topic }
  | { key: string; kind: 'go'; item: GoToItem }
  | { key: string; kind: 'link'; item: LinkItem };

export interface Group {
  id: 'ask' | 'topics' | 'go' | 'links';
  label: string;
  options: Option[];
}

export interface Results {
  groups: Group[];
  options: Option[];
  /** The option Enter runs before the visitor moves the selection. */
  defaultKey: string | null;
}

/** Topics the Links group already covers, so they are not listed twice. */
const linkedTopics = new Set<Topic['id']>(['contact', 'github', 'linkedin']);
const stopWords = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'my', 'me', 'go', 'open', 'show']);
const questionStart =
  /^(what|whats|how|why|who|whos|when|where|which|do|does|did|is|are|was|can|could|would|should|tell|explain|describe|has|have)\b/;

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const char of haystack) if (char === needle[i]) i += 1;
  return i === needle.length;
}

/**
 * Forgiving label match: every typed word must hit the label (word prefix, substring or, for
 * longer words, an in-order subsequence) or a keyword. Earlier and fuller hits score higher.
 */
export function fuzzyScore(query: string, label: string, keywords: readonly string[] = []): number {
  const q = normalize(query);
  if (!q) return 0;
  const text = normalize(label);
  const words = text.split(' ');
  const extra = keywords.flatMap((keyword) => normalize(keyword).split(' '));
  let score = 0;
  let matched = false;
  for (const token of q.split(' ')) {
    if (words[0]?.startsWith(token)) score += 3;
    else if (words.some((word) => word.startsWith(token))) score += 2;
    else if (extra.some((word) => word.startsWith(token))) score += 1.5;
    else if (token.length >= 3 && text.includes(token)) score += 1;
    else if (token.length >= 3 && isSubsequence(token, text.replaceAll(' ', ''))) score += 0.5;
    else if (stopWords.has(token)) continue;
    else return 0;
    matched = true;
  }
  if (!matched) return 0;
  return text.startsWith(q) ? score + 2 : score;
}

export function looksLikeQuestion(query: string): boolean {
  const q = normalize(query);
  return query.trim().endsWith('?') || q.split(' ').length >= 4 || questionStart.test(q);
}

function topicScore(topic: Topic, query: string): number {
  const extra = [
    topic.hint,
    ...(topic.names ?? []),
    ...topic.keywords.map((k) => k.replace('*', '')),
  ];
  return fuzzyScore(query, topic.title, extra) + keywordScore(topic, normalize(query));
}

function ranked<T>(items: T[], score: (item: T) => number, limit: number) {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function search(query: string): Results {
  const q = query.trim();
  const listed = topics.filter((topic) => !linkedTopics.has(topic.id));

  if (!q) {
    const groups: Group[] = [
      {
        id: 'topics',
        label: 'Topics',
        options: featuredTopicIds.map((id) => ({
          key: `topic:${id}`,
          kind: 'topic',
          topic: topicById(id),
        })),
      },
      {
        id: 'go',
        label: 'Go to',
        options: goToItems.map((item) => ({ key: `go:${item.id}`, kind: 'go', item })),
      },
      {
        id: 'links',
        label: 'Links',
        options: linkItems.map((item) => ({ key: `link:${item.id}`, kind: 'link', item })),
      },
    ];
    const options = groups.flatMap((group) => group.options);
    return { groups, options, defaultKey: options[0]?.key ?? null };
  }

  const topicHits = ranked(listed, (topic) => topicScore(topic, q), 5);
  const goHits = ranked(goToItems, (item) => fuzzyScore(q, item.label, item.keywords), 5);
  const linkHits = ranked(linkItems, (item) => fuzzyScore(q, item.label, item.keywords), 5);

  const all: Group[] = [
    { id: 'ask', label: 'Ask', options: [{ key: 'ask', kind: 'ask', query: q }] },
    {
      id: 'topics',
      label: 'Topics',
      options: topicHits.map(({ item }) => ({
        key: `topic:${item.id}`,
        kind: 'topic',
        topic: item,
      })),
    },
    {
      id: 'go',
      label: 'Go to',
      options: goHits.map(({ item }) => ({ key: `go:${item.id}`, kind: 'go', item })),
    },
    {
      id: 'links',
      label: 'Links',
      options: linkHits.map(({ item }) => ({ key: `link:${item.id}`, kind: 'link', item })),
    },
  ];
  const groups = all.filter((group) => group.options.length > 0);

  // Questions go to Ask; short, navigational queries jump to their best match.
  let defaultKey = 'ask';
  if (!looksLikeQuestion(q)) {
    const best = [
      ...topicHits.map(({ item, score }) => ({ key: `topic:${item.id}`, score })),
      ...goHits.map(({ item, score }) => ({ key: `go:${item.id}`, score: score + 0.25 })),
      ...linkHits.map(({ item, score }) => ({ key: `link:${item.id}`, score: score + 0.25 })),
    ].sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 2) defaultKey = best.key;
  }

  return { groups, options: groups.flatMap((group) => group.options), defaultKey };
}
