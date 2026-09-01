/**
 * Where the visitor's country reaches the client.
 *
 * This module runs in the browser and so cannot read a request header itself.
 * Country has to be decided during the request and handed to the *document*;
 * `proxy.ts` is what does the handing on Vercel today. What follows accepts
 * every cheap form the answer can arrive in, whatever put it there:
 *
 *   - `window.__UNCHAINED_COUNTRY__` — an injected inline script
 *   - `<meta name="x-vercel-ip-country" content="RU">` — Vercel edge/middleware
 *   - `<meta name="cf-ipcountry" content="RU">` — a Cloudflare HTMLRewriter
 *   - `<meta name="x-country" content="RU">` — anything else
 *   - an `unchained.country` cookie written by any of the above
 *
 * All of those are synchronous and free. When none is present `readCountry()`
 * returns null and detection falls to the next signal — the site still works.
 * Behind Cloudflare, `requestCountry()` can recover the code from the
 * same-origin `/cdn-cgi/trace` endpoint, and it is only called when no edge
 * signal was present at all, so with `proxy.ts` answering the ordinary visit
 * makes no extra request. On Vercel that endpoint is not Cloudflare's and
 * returns an HTML 404, which the `res.ok` and content-type guards below
 * reject rather than parse.
 *
 * No third-party geolocation service is contacted, and nothing finer than a
 * two-letter country code is ever read, stored or reported.
 */

const META_NAMES = ['x-vercel-ip-country', 'cf-ipcountry', 'x-country'];
const COUNTRY_COOKIE = 'unchained.country';
const CLOUDFLARE_TRACE_URL = '/cdn-cgi/trace';

const ALPHA_2 = /^[A-Z]{2}$/;
const TRACE_LOC = /(?:^|\n)loc=([A-Z]{2})(?:\n|$)/;

type CountryWindow = Window & { __UNCHAINED_COUNTRY__?: unknown };

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  // `XX` and `T1` are Cloudflare's "unknown"/Tor placeholders.
  return ALPHA_2.test(code) && code !== 'XX' ? code : null;
}

function fromCookie(): string | null {
  for (const pair of document.cookie.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    if (pair.slice(0, eq).trim() !== COUNTRY_COOKIE) continue;
    return normalize(decodeURIComponent(pair.slice(eq + 1).trim()));
  }
  return null;
}

/** The country the page was served with, or null if the edge told us nothing. */
export function readCountry(): string | null {
  if (typeof document === 'undefined') return null;

  const injected = normalize((window as CountryWindow).__UNCHAINED_COUNTRY__);
  if (injected) return injected;

  for (const name of META_NAMES) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    const value = normalize(meta?.getAttribute('content'));
    if (value) return value;
  }

  return fromCookie();
}

let tracePromise: Promise<string | null> | null = null;

/**
 * Last-resort country lookup over Cloudflare's own `/cdn-cgi/trace`.
 *
 * Same-origin, a few dozen bytes, no third party and no API key. Resolves to
 * null anywhere that endpoint does not exist, and the result is memoised so a
 * page only ever asks once.
 */
export function requestCountry(): Promise<string | null> {
  tracePromise ??= (async () => {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(CLOUDFLARE_TRACE_URL, {
        credentials: 'omit',
        redirect: 'error',
      });
      // Anywhere but Cloudflare this is an HTML 404 page, not a trace.
      if (!res.ok) return null;
      if (!res.headers.get('content-type')?.startsWith('text/plain')) {
        return null;
      }
      return normalize(TRACE_LOC.exec(await res.text())?.[1]);
    } catch {
      return null;
    }
  })();

  return tracePromise;
}
