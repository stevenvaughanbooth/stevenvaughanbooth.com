import 'server-only';
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { VISITOR_LIMIT } from '@/lib/ask-contract';

/**
 * Who is asking. Each browser gets a random id in a signed, HttpOnly, first-party cookie, so the
 * per-visitor allowance belongs to a person rather than to an address: several reviewers behind
 * one office NAT each get their own questions. Clearing the cookie only mints a new id, which is
 * why a looser per-network cap (rate-limit.ts) sits underneath as the abuse bound.
 *
 * The cookie also carries a signed hint of the questions left, so GET /api/ask can report it
 * without touching Redis. The hint is for display only; POST asks Redis and refreshes it.
 */
export interface Visitor {
  /** Random and opaque: the per-visitor rate-limit key. */
  id: string;
  /** Questions left as of `issuedAt`. */
  remaining: number;
  /** Milliseconds since the epoch. */
  issuedAt: number;
}

export interface VisitorKeys {
  /** Signs the visitor cookie. */
  cookie: Buffer;
  /** Keys the per-network limit, so Redis holds no address or reversible hash of one. */
  network: Buffer;
}

/** The allowance's window: a hint older than this is out of date. */
const WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * The 24-hour sliding window counts the previous day bucket too, so a question can weigh on the
 * allowance for up to two days. The id must live that long; it is refreshed on every visit.
 */
const MAX_AGE_SECONDS = 2 * 24 * 60 * 60;
/** Tolerated clock difference between server instances. */
const SKEW_MS = 5 * 60 * 1000;

const ID_BYTES = 16;
const FORMAT = /^([A-Za-z0-9_-]{22})\.(\d)\.(\d{1,13})\.([A-Za-z0-9_-]{43})$/;

let cachedKeys: { apiKey: string; keys: VisitorKeys } | undefined;

/**
 * Derives the signing keys from the Anthropic key with HKDF, so there is no extra secret to
 * manage and neither key reveals anything about the API key. Rotating the API key invalidates
 * every cookie, which simply gives each visitor a fresh allowance.
 */
export function visitorKeys(apiKey: string): VisitorKeys {
  if (cachedKeys?.apiKey !== apiKey) {
    const derive = (info: string) =>
      Buffer.from(hkdfSync('sha256', apiKey, '', `stevenvaughanbooth.com/ask ${info} v1`, 32));
    cachedKeys = { apiKey, keys: { cookie: derive('visitor cookie'), network: derive('network') } };
  }
  return cachedKeys.keys;
}

/** `__Host-` pins the cookie to this exact origin over HTTPS, so no subdomain can set or read it. */
export function cookieName(secure: boolean): string {
  return secure ? '__Host-ask' : 'ask';
}

function sign(key: Buffer, { id, remaining, issuedAt }: Visitor): string {
  return createHmac('sha256', key).update(`v1.${id}.${remaining}.${issuedAt}`).digest('base64url');
}

function readCookie(headers: Headers, name: string): string | undefined {
  for (const part of headers.get('cookie')?.split(';') ?? []) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

function verify(value: string, key: Buffer, now: number): Visitor | null {
  const match = FORMAT.exec(value);
  if (!match) return null;
  const [, id = '', count = '', at = '', signature = ''] = match;
  const visitor = { id, remaining: Number(count), issuedAt: Number(at) };
  if (visitor.remaining > VISITOR_LIMIT || visitor.issuedAt > now + SKEW_MS) return null;
  const expected = Buffer.from(sign(key, visitor));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? visitor : null;
}

/**
 * The visitor this request comes from. A missing, tampered or foreign cookie gets a fresh id with
 * the full allowance; Redis still decides what that id may spend.
 */
export function readVisitor(
  headers: Headers,
  key: Buffer,
  { secure, now = Date.now() }: { secure: boolean; now?: number },
): Visitor {
  const value = readCookie(headers, cookieName(secure));
  return (
    (value && verify(value, key, now)) || {
      id: randomBytes(ID_BYTES).toString('base64url'),
      remaining: VISITOR_LIMIT,
      issuedAt: now,
    }
  );
}

/** Questions to show as left. A hint older than the window shows the full allowance again. */
export function remainingHint(visitor: Visitor, now = Date.now()): number {
  return now - visitor.issuedAt >= WINDOW_MS ? VISITOR_LIMIT : visitor.remaining;
}

/** The Set-Cookie value that stores (or refreshes) the visitor. */
export function visitorCookie(visitor: Visitor, key: Buffer, { secure }: { secure: boolean }) {
  return [
    `${cookieName(secure)}=${visitor.id}.${visitor.remaining}.${visitor.issuedAt}.${sign(key, visitor)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
