import 'server-only';

const LOCALHOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Accepts only requests a browser made from this site's own pages. Browsers always send `Origin`
 * on a POST and cannot forge it; `Sec-Fetch-Site`, when present, must agree. In development any
 * localhost origin is allowed so the app can be reached through a different local port or proxy.
 */
export function isSameOrigin(headers: Headers, { dev = false }: { dev?: boolean } = {}): boolean {
  const origin = headers.get('origin');
  if (!origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (dev && LOCALHOSTS.has(url.hostname)) return true;

  const site = headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;

  const host = headers.get('host')?.toLowerCase();
  return Boolean(host) && url.host === host;
}
