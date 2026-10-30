// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { VISITOR_LIMIT } from '@/lib/ask-contract';
import { cookieName, readVisitor, remainingHint, visitorCookie, visitorKeys } from './visitor';

const KEY = 'sk-ant-api03-test-only-not-a-real-key';
const keys = visitorKeys(KEY);
const NOW = Date.UTC(2026, 9, 30, 12);
const DAY = 24 * 60 * 60 * 1000;

/** The cookie a browser would send back, from a Set-Cookie value. */
function sent(setCookie: string): Headers {
  return new Headers({ cookie: `theme=dark; ${setCookie.split(';')[0]}; other=1` });
}

function issue(remaining: number, issuedAt = NOW, secure = true) {
  const visitor = { id: 'AAAAAAAAAAAAAAAAAAAAAA', remaining, issuedAt };
  return { visitor, cookie: visitorCookie(visitor, keys.cookie, { secure }) };
}

describe('visitor keys', () => {
  it('derives separate, stable keys from the API key without exposing it', () => {
    expect(visitorKeys(KEY).cookie.equals(keys.cookie)).toBe(true);
    expect(keys.cookie).toHaveLength(32);
    expect(keys.cookie.equals(keys.network)).toBe(false);
    expect(keys.cookie.toString('latin1')).not.toContain('sk-ant');
    expect(visitorKeys(`${KEY}-rotated`).cookie.equals(keys.cookie)).toBe(false);
  });
});

describe('visitor cookie', () => {
  it('is HttpOnly, Secure, SameSite=Lax and host-only in production', () => {
    const { cookie } = issue(2);
    expect(cookie).toMatch(/^__Host-ask=[\w-]{22}\.2\.\d{13}\.[\w-]{43}; /);
    expect(cookie).toContain('; Path=/');
    expect(cookie).toContain('; HttpOnly');
    expect(cookie).toContain('; Secure');
    expect(cookie).toContain('; SameSite=Lax');
    expect(cookie).toMatch(/; Max-Age=172800(;|$)/);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('drops the __Host- prefix and Secure only for plain-HTTP development', () => {
    expect(cookieName(false)).toBe('ask');
    const { cookie } = issue(2, NOW, false);
    expect(cookie).toMatch(/^ask=/);
    expect(cookie).not.toContain('Secure');
  });

  it('round-trips the id and the remaining hint', () => {
    const { visitor, cookie } = issue(1);
    expect(readVisitor(sent(cookie), keys.cookie, { secure: true, now: NOW })).toEqual(visitor);
  });

  it('mints a fresh visitor with the full allowance when the cookie is missing or invalid', () => {
    const { cookie } = issue(0);
    const value = cookie.split(';')[0] ?? '';
    const forged = (replace: (text: string) => string) => new Headers({ cookie: replace(value) });
    for (const headers of [
      new Headers(),
      new Headers({ cookie: '__Host-ask=garbage' }),
      // A visitor raising their own count invalidates the signature.
      forged((text) => text.replace('.0.', '.3.')),
      // Someone else's id with this signature.
      forged((text) => text.replace('AAAA', 'BBBB')),
      forged((text) => `${text.slice(0, -2)}xx`),
      // The development cookie name means nothing in production.
      forged((text) => text.replace('__Host-ask', 'ask')),
    ]) {
      const visitor = readVisitor(headers, keys.cookie, { secure: true, now: NOW });
      expect(visitor.id).toMatch(/^[\w-]{22}$/);
      expect(visitor.id).not.toBe('AAAAAAAAAAAAAAAAAAAAAA');
      expect(visitor.remaining).toBe(VISITOR_LIMIT);
    }
  });

  it('rejects a cookie signed with another key, or issued in the future', () => {
    const other = visitorKeys('another-key');
    const visitor = { id: 'AAAAAAAAAAAAAAAAAAAAAA', remaining: 0, issuedAt: NOW };
    const foreign = visitorCookie(visitor, other.cookie, { secure: true });
    const fresh = (headers: Headers) =>
      readVisitor(headers, keys.cookie, { secure: true, now: NOW }).id !== visitor.id;
    expect(fresh(sent(foreign))).toBe(true);

    const { cookie } = issue(0, NOW + DAY);
    expect(fresh(sent(cookie))).toBe(true);
  });

  it('mints distinct ids', () => {
    const ids = new Set(
      Array.from(
        { length: 50 },
        () => readVisitor(new Headers(), keys.cookie, { secure: true }).id,
      ),
    );
    expect(ids.size).toBe(50);
  });
});

describe('remainingHint', () => {
  it('reports the hint until the allowance window has passed', () => {
    const { visitor } = issue(0);
    expect(remainingHint(visitor, NOW)).toBe(0);
    expect(remainingHint(visitor, NOW + DAY - 1)).toBe(0);
    expect(remainingHint(visitor, NOW + DAY)).toBe(VISITOR_LIMIT);
  });
});
