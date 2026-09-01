import { NextResponse, type NextRequest } from 'next/server';

/**
 * Hands the visitor's country to the document.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────
 * `lib/commercial/countryDetection.ts` reads country from three rungs, in
 * descending order of trust: an edge signal on the document, the platform's
 * own country endpoint, then the region subtag of a browser locale. On a
 * static export served by Vercel the first two answer nothing —
 * `/cdn-cgi/trace` is a Cloudflare endpoint and Vercel returns an HTML 404 for
 * it — so every visitor fell through to rung 3.
 *
 * Rung 3 is not merely weaker. It is WRONG in a way the other two are not.
 * `navigator.languages` of `['es', 'en-US', 'en']` — a Spanish speaker whose
 * browser also lists US English — yields `US`, because `es` carries no region
 * and `en-US` does. The inquiry is then routed on a country the visitor is not
 * in. A null country produces the global fallback, which is honest; a
 * confidently wrong country produces the wrong representative, which is not.
 *
 * `x-vercel-ip-country` is on every request Vercel serves and is the signal
 * rung 1 was written for. This file is the ten lines that stop us discarding
 * it.
 *
 * ─── Why a cookie, and not headers() in the layout ────────────────────────
 * Reading `headers()` in the root layout would opt the whole page into dynamic
 * rendering and give up the CDN cache for a landing page that is otherwise
 * entirely static. The proxy runs on every request regardless of whether the
 * page itself was served from cache, so writing the cookie here keeps the
 * pages static and still gives the client a per-visitor answer.
 *
 * The `Set-Cookie` rides on the very response that carries the document, so
 * the value is readable by `fromCookie()` on first load — there is no
 * second-visit warm-up.
 *
 * Nothing finer than a two-letter country code is read, and it is never sent
 * anywhere but to the resolver that already receives it (§6, §25).
 */

/** The name `lib/i18n/languageDetection/countrySignal.ts` already looks for. */
const COUNTRY_COOKIE = 'unchained.country';

const ALPHA_2 = /^[A-Z]{2}$/;

/**
 * `XX` is the conventional unknown placeholder and `T1` is Cloudflare's Tor
 * exit marker. Neither is a country, and both must fall through to the next
 * rung rather than be written as if they were an answer.
 */
const NOT_A_COUNTRY = new Set(['XX', 'T1']);

/**
 * Vercel's own header first, then the two other edge layers this site could
 * plausibly end up behind. Same list, same order, same meaning as the `<meta>`
 * names in countrySignal.ts — the two files agree on purpose.
 */
const COUNTRY_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry', 'x-country'];

function countryFrom(request: NextRequest): string | null {
  for (const header of COUNTRY_HEADERS) {
    const value = request.headers.get(header)?.trim().toUpperCase();
    if (value && ALPHA_2.test(value) && !NOT_A_COUNTRY.has(value)) return value;
  }
  return null;
}

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const country = countryFrom(request);

  // No header means no signal, and no signal means we write nothing: an absent
  // cookie lets detection fall to the locale rung, whereas a cookie holding a
  // guess would outrank it. Preserving "we do not know" is the point (§23).
  if (country) {
    response.cookies.set(COUNTRY_COOKIE, country, {
      // Deliberately readable by script: countrySignal.ts reads it through
      // `document.cookie`. It carries no identity and grants no access, so
      // there is nothing here for httpOnly to protect.
      httpOnly: false,
      sameSite: 'lax',
      secure: true,
      path: '/',
      // An hour. Long enough that a visitor reading several pages is looked up
      // once, short enough that a traveller is not pinned to yesterday's
      // country for the life of the browser.
      maxAge: 60 * 60,
    });
  }

  return response;
}

/**
 * Documents only. Static assets and the favicon carry the same header and
 * would set the same cookie, so running there would be pure overhead on
 * requests whose response no one reads a cookie from.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.[^/]+$).*)'],
};
