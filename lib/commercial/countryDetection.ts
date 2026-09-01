import { readCountry, requestCountry } from '@/lib/i18n/languageDetection';

/**
 * Where the visitor's country comes from, for routing purposes only.
 *
 * ─── Where the signal comes from (§6) ─────────────────────────────────────
 * The site runs on Vercel, and `proxy.ts` writes `x-vercel-ip-country` into
 * the `unchained.country` cookie before the document is served, so step 1
 * below is answered on the ordinary visit. Until 2026-08-31 this was a static
 * export on GitHub Pages with no request phase at all: every country header
 * was discarded before our code ran and every visitor fell through to step 3.
 * See docs/hosting.md.
 *
 * `lib/i18n/languageDetection/countrySignal.ts` reads every cheap form the
 * signal can arrive in — an injected global, a `<meta>` the edge rewrote in,
 * the cookie, or Cloudflare's own same-origin `/cdn-cgi/trace`. That module is
 * reused here rather than reimplemented: country is detected ONCE per page and
 * the language chooser and the router read the same value, so the two can
 * never disagree about where the visitor is.
 *
 * No third-party IP-geolocation API is contacted (§6), no paid service is
 * introduced, and the browser's Geolocation API is never touched, so no
 * permission prompt is ever shown (§25). Nothing finer than a two-letter
 * country code is read, and the code is never stored or sent to analytics.
 */

/** ISO 3166-1 alpha-2, upper case. */
const ALPHA_2 = /^[A-Z]{2}$/;

/**
 * The region subtag of a BCP 47 tag: `en-GB` → GB, `zh-Hans-CN` → CN.
 *
 * Anchored, and it requires the tag to actually HAVE a region. A bare `en`
 * matches nothing, which is the point — §7 forbids inferring country from the
 * browser language alone, and `en` is a language, not a place. The optional
 * four-letter group is the script subtag. UN M49 numeric regions (`es-419`,
 * "Latin America") are not matched: they are not countries and the resolver
 * keys on ISO codes.
 */
const REGION_SUBTAG = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})(?:-|$)/;

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  // `XX` is the conventional "unknown" placeholder and is not a country.
  return ALPHA_2.test(code) && code !== 'XX' ? code : null;
}

/** First explicit region in the visitor's ordered language preferences. */
export function regionFromLocaleTags(
  tags: readonly string[] | null | undefined,
): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const code = normalize(REGION_SUBTAG.exec(tag)?.[1]);
    if (code) return code;
  }
  return null;
}

export type CountrySource = 'edge' | 'platform' | 'locale' | 'none';

export interface CountrySignals {
  /** What the hosting layer put on the document, if anything. */
  edge?: string | null;
  /** What the platform's own same-origin trace endpoint answered. */
  platform?: string | null;
  /** `navigator.languages`, most-preferred first. */
  localeTags?: readonly string[] | null;
}

export interface CountryDetection {
  /** ISO 3166-1 alpha-2, or null when nothing reliable said. */
  country: string | null;
  source: CountrySource;
}

/**
 * The one decision function. Pure, synchronous, total — every combination of
 * signals maps to exactly one outcome, in §7's order of trust:
 *
 *   1. the server/edge country signal on the document
 *   2. the platform's own country endpoint (already an app-level context:
 *      the same memoised lookup the language chooser uses)
 *   3. the region subtag of a browser locale, when one is explicitly present
 *   4. no country
 *
 * Timezone, currency and bare browser language are deliberately absent: §7
 * names all three as unreliable country identifiers, and they are. A traveller
 * with a German laptop in Milan is not a German lead, and `en` is not the US.
 *
 * Step 3 is a last resort rather than a strategy, and it fails LOUDLY wrong
 * rather than quietly vague: it returns the first tag that HAS a region, so
 * `['es', 'en-US', 'en']` — an ordinary Chrome default for a Spanish speaker —
 * yields US for someone who has never been there. With step 1 answering it
 * should now be reached only when the edge sent no country at all.
 *
 * Step 4 is a real answer, not a failure. The visitor still starts a project;
 * the resolver simply decides on language and the global fallback (§23).
 */
export function pickCountry(signals: CountrySignals): CountryDetection {
  const edge = normalize(signals.edge);
  if (edge) return { country: edge, source: 'edge' };

  const platform = normalize(signals.platform);
  if (platform) return { country: platform, source: 'platform' };

  const locale = regionFromLocaleTags(signals.localeTags);
  if (locale) return { country: locale, source: 'locale' };

  return { country: null, source: 'none' };
}

let detection: Promise<CountryDetection> | null = null;

/**
 * Gather the signals and decide. Memoised for the life of the page (§26):
 * country does not change while someone reads a landing page, and the
 * platform lookup behind step 2 is itself memoised, so a visitor who opens the
 * contact panel from four different CTAs causes exactly one lookup.
 */
export function detectCountry(): Promise<CountryDetection> {
  detection ??= (async () => {
    const edge = readCountry();
    // Only worth asking the platform when the document said nothing: the
    // request costs a round trip and cannot beat a signal we already hold.
    const platform = edge ? null : await requestCountry();

    return pickCountry({
      edge,
      platform,
      localeTags:
        typeof navigator === 'undefined'
          ? null
          : (navigator.languages ?? [navigator.language]),
    });
  })();

  return detection;
}

/** Test seam. Never called by the app. */
export function resetCountryDetection(): void {
  detection = null;
}
