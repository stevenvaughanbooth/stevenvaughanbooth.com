import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './origin';

const site = 'stevenvaughanbooth.com';
const headers = (values: Record<string, string>) => new Headers(values);

describe('isSameOrigin', () => {
  it('accepts a request from the site itself', () => {
    expect(isSameOrigin(headers({ host: site, origin: `https://${site}` }))).toBe(true);
    expect(
      isSameOrigin(
        headers({ host: site, origin: `https://${site}`, 'sec-fetch-site': 'same-origin' }),
      ),
    ).toBe(true);
  });

  it('rejects other origins, including look-alikes and subdomains', () => {
    for (const origin of [
      'https://evil.example',
      `https://${site}.evil.example`,
      `https://www.${site}`,
      `https://${site}:8443`,
    ]) {
      expect(isSameOrigin(headers({ host: site, origin }))).toBe(false);
    }
  });

  it('rejects a missing, opaque or malformed Origin', () => {
    expect(isSameOrigin(headers({ host: site }))).toBe(false);
    expect(isSameOrigin(headers({ host: site, origin: 'null' }))).toBe(false);
    expect(isSameOrigin(headers({ host: site, origin: 'not a url' }))).toBe(false);
  });

  it('rejects when Sec-Fetch-Site disagrees', () => {
    for (const value of ['cross-site', 'same-site', 'none']) {
      expect(
        isSameOrigin(headers({ host: site, origin: `https://${site}`, 'sec-fetch-site': value })),
      ).toBe(false);
    }
  });

  it('rejects when the Host header is missing', () => {
    expect(isSameOrigin(headers({ origin: `https://${site}` }))).toBe(false);
  });

  it('allows any localhost origin only in development', () => {
    const local = headers({
      host: 'localhost:3000',
      origin: 'http://127.0.0.1:4000',
      'sec-fetch-site': 'same-site',
    });
    expect(isSameOrigin(local, { dev: true })).toBe(true);
    expect(isSameOrigin(local)).toBe(false);
    expect(
      isSameOrigin(headers({ host: site, origin: 'https://evil.example' }), { dev: true }),
    ).toBe(false);
  });
});
