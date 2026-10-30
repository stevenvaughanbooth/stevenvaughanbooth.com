import 'server-only';
import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { VISITOR_LIMIT } from '@/lib/ask-contract';
import type { RedisConfig } from './config';
import { logAskError } from './log';

/**
 * Live questions per network (an IPv4 address or an IPv6 /64) in any 24 hours. Visitors are
 * counted by cookie, which costs nothing to clear, so this is the abuse bound: loose enough for an
 * office of reviewers behind one address, tight enough that a script cannot take the whole day.
 */
export const NETWORK_LIMIT = 20;
/** Site-wide questions per minute, so a burst cannot spend the day's allowance at once. */
const BURST_LIMIT = 10;
/** Site-wide questions per UTC day. With the Console spend limit, this bounds the cost of abuse. */
const DAILY_LIMIT = 150;
/** `SET ask:disabled 1` turns live answers off instantly; `DEL ask:disabled` turns them back on. */
export const KILL_KEY = 'ask:disabled';

type LimitResult = Awaited<ReturnType<Ratelimit['limit']>>;

const GLOBAL = 'global';
const REDIS_TIMEOUT_MS = 2_500;

/** Rate-limit keys for one request. */
export interface Requester {
  /** The signed cookie's random id. */
  visitor: string;
  /** A keyed hash of the network (see networkKey). */
  network: string;
}

export type Decision =
  | { ok: true; remaining: number }
  /** disabled: the kill switch is set. closed: the day's site-wide budget is spent. */
  | { ok: false; reason: 'disabled' | 'closed' | 'limit_reached' }
  | { ok: false; reason: 'busy'; retryAfter: number };

/** Thrown when Redis cannot give a definite answer. Callers fail closed. */
export class RateLimitUnavailableError extends Error {
  override name = 'RateLimitUnavailableError';
}

interface Limiters {
  redis: Redis;
  visitor: Ratelimit;
  network: Ratelimit;
  burst: Ratelimit;
  daily: Ratelimit;
}

let cached: (RedisConfig & { limiters: Limiters }) | undefined;

function limiters(config: RedisConfig): Limiters {
  if (cached?.url === config.url && cached.token === config.token) return cached.limiters;

  const redis = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    retry: { retries: 1, backoff: () => 100 },
    // A signal factory makes a timed-out command throw. A plain signal would resolve it as null,
    // which would read as "not disabled".
    signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  // On its own timeout the library lets the request through; `settled` turns that into a failure.
  const options = { redis, timeout: REDIS_TIMEOUT_MS + 500, analytics: false };
  const created = {
    redis,
    visitor: new Ratelimit({
      ...options,
      prefix: 'ask:visitor',
      limiter: Ratelimit.slidingWindow(VISITOR_LIMIT, '24 h'),
    }),
    network: new Ratelimit({
      ...options,
      prefix: 'ask:network',
      limiter: Ratelimit.slidingWindow(NETWORK_LIMIT, '24 h'),
    }),
    burst: new Ratelimit({
      ...options,
      prefix: 'ask:burst',
      limiter: Ratelimit.slidingWindow(BURST_LIMIT, '1 m'),
    }),
    daily: new Ratelimit({
      ...options,
      prefix: 'ask:daily',
      // Fixed windows of a day start at 00:00 UTC.
      limiter: Ratelimit.fixedWindow(DAILY_LIMIT, '1 d'),
    }),
  };
  cached = { ...config, limiters: created };
  return created;
}

function settled(result: LimitResult): LimitResult {
  if (result.reason === 'timeout') throw new RateLimitUnavailableError('timeout');
  return result;
}

function busy(reset: number): Decision {
  return {
    ok: false,
    reason: 'busy',
    retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}

type Unit = [limiter: Ratelimit, id: string];

/**
 * Returns units already spent. Best effort: if Redis fails here, the failure is logged and the
 * visitor is out one question until the window moves on.
 */
async function giveBack(units: Unit[]): Promise<void> {
  try {
    await Promise.all(units.map(([limiter, id]) => limiter.limit(id, { rate: -1 })));
  } catch (err) {
    logAskError('ratelimit refund', err);
  }
}

/**
 * Spends one question, or nothing. In order:
 *
 * 1. Read-only: the kill switch and the site-wide budgets. While live answers are off, closed for
 *    the day or busy this minute, nobody's own allowance is touched.
 * 2. The visitor's and the network's allowances. A sliding window does not count a rejected
 *    request, and if only one of the two passes, its unit is given back.
 * 3. The site-wide budgets, spent only after the visitor's own checks pass, so a visitor out of
 *    questions can never drain them. If one rejects here (another request took the last unit since
 *    step 1), every unit this request spent is given back.
 *
 * So a request that does not go ahead costs no one anything, short of a Redis failure midway.
 */
export async function consume(config: RedisConfig, who: Requester): Promise<Decision> {
  const { redis, visitor, network, burst, daily } = limiters(config);

  const [flag, dayLeft, minuteLeft] = await Promise.all([
    redis.get(KILL_KEY),
    daily.getRemaining(GLOBAL),
    burst.getRemaining(GLOBAL),
  ]);
  if (flag !== null) return { ok: false, reason: 'disabled' };
  if (dayLeft.remaining <= 0) return { ok: false, reason: 'closed' };
  if (minuteLeft.remaining <= 0) return busy(minuteLeft.reset);

  const own: Unit[] = [
    [visitor, who.visitor],
    [network, who.network],
  ];
  const [mine, theirs] = (await Promise.all(own.map(([l, id]) => l.limit(id)))).map(settled);
  if (!mine?.success || !theirs?.success) {
    await giveBack(own.filter((_, i) => [mine, theirs][i]?.success));
    return { ok: false, reason: 'limit_reached' };
  }

  const shared: Unit[] = [
    [burst, GLOBAL],
    [daily, GLOBAL],
  ];
  const [minute, day] = (await Promise.all(shared.map(([l, id]) => l.limit(id)))).map(settled);
  if (!minute?.success || !day?.success) {
    // A fixed window counts even a rejected request, but only once the day is already spent.
    await giveBack([...own, ...shared.filter((_, i) => [minute, day][i]?.success)]);
    return !day?.success ? { ok: false, reason: 'closed' } : busy(minute?.reset ?? Date.now());
  }

  return { ok: true, remaining: Math.max(0, mine.remaining) };
}

/**
 * Returns a question when Claude could not answer it (HTTP 502): the visitor's and the network's
 * units and the day's budget, since nothing was spent upstream. The minute's burst unit stays
 * spent, so retries against a failing upstream are still throttled.
 */
export async function refund(config: RedisConfig, who: Requester): Promise<void> {
  const { visitor, network, daily } = limiters(config);
  await giveBack([
    [visitor, who.visitor],
    [network, who.network],
    [daily, GLOBAL],
  ]);
}

/** The client address as Vercel reports it. Vercel overwrites both headers, so they can't be spoofed. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * The network a visitor controls. IPv6 users typically hold a whole /64 and can rotate addresses
 * within it at will, so they share one allowance per /64. IPv4-mapped addresses count as IPv4.
 */
export function networkOf(ip: string): string {
  const address = ip.toLowerCase().split('%')[0] ?? '';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped?.[1]) return mapped[1];
  if (!address.includes(':')) return address;

  const [head = '', tail, ...rest] = address.split('::');
  if (rest.length > 0) return address;
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups =
    tail === undefined ? left : [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  const prefix = groups.slice(0, 4);
  if (prefix.length < 4 || !prefix.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return address;
  return `${prefix.map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
}

/**
 * A keyed, one-way key for the visitor's network. A plain hash of an IPv4 address can be reversed
 * by trying all four billion; without the server's key, this one cannot.
 */
export function networkKey(headers: Headers, key: Buffer): string {
  return createHmac('sha256', key)
    .update(networkOf(clientIp(headers)))
    .digest('hex');
}
