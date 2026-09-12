/**
 * Reading untrusted values out of a CMS payload.
 *
 * ─── Why this exists as a module ──────────────────────────────────────────
 * Every row the website receives from the database is untrusted input. Not
 * because anybody expects the database to be hostile, but because the values
 * in it are typed by people through a form, arrive over the network as JSON,
 * and are rendered into a page that has to stay correct when one of them is
 * empty, absurdly long, or a control character.
 *
 * lib/portfolio.ts worked this out first and these functions are its, moved
 * here unchanged so that insights — and the next content type after it — apply
 * the same rules rather than a second set that drifts. The behaviour is pinned
 * by lib/portfolio.test.ts, which exercises toProject() over them.
 *
 * ─── What this is NOT protecting against ──────────────────────────────────
 * Markup injection. React escapes everything it renders, and nothing here is
 * passed to dangerouslySetInnerHTML. The risk being addressed is narrower and
 * stranger: a stored string carrying a bidirectional override that rearranges
 * the sentence around it on screen, or a zero-width character that makes two
 * different slugs look identical.
 */

/**
 * Control characters, zero-width characters and bidirectional overrides.
 *
 * The line feed is deliberately NOT in the class. Some of the fields these
 * functions read — a project's summary, an article's paragraphs — are prose
 * somebody may have written in paragraphs, and stripping their line breaks
 * would run those paragraphs together on the page. `collapse` is what decides
 * per field whether newlines survive.
 */
const UNDISPLAYABLE =
  /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/**
 * A displayable string, or null.
 *
 * `collapse` true — the default — flattens all whitespace, which is right for
 * a title, a category or a label. False keeps newlines and flattens only the
 * spaces around them, which is right for anything rendered as paragraphs.
 */
export function text(
  value: unknown,
  max: number,
  collapse = true,
): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.replace(UNDISPLAYABLE, ' ');
  const clean = collapse
    ? stripped.replace(/\s+/g, ' ').trim()
    : stripped.replace(/[^\S\n]+/g, ' ').trim();
  return clean === '' ? null : clean.slice(0, max);
}

/** Strictly true. Anything else — 'true', 1, null — is false. */
export function bool(value: unknown): boolean {
  return value === true;
}

/** A four-digit year as a string, or undefined. */
export function year(value: unknown): string | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return undefined;
  return String(n);
}

/** A positive integer within a plausible pixel range, or undefined. */
export function size(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return undefined;
  return n;
}

/**
 * A list of short labels, with the empties dropped.
 *
 * Returns undefined rather than [] for an empty list, because the components
 * render these sections conditionally on the property being present and an
 * empty array would produce a heading over nothing.
 */
export function labels(value: unknown, max = 80): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const clean = value
    .map((entry) => text(entry, max))
    .filter((entry): entry is string => entry !== null);
  return clean.length > 0 ? clean : undefined;
}

/**
 * An image the site is willing to render, or undefined.
 *
 * Two forms are accepted, and they are the two the database's own
 * `unchained_media_reference_ok()` accepts:
 *
 *   · a site-relative path — a file committed to public/;
 *   · an object in this project's public CMS bucket.
 *
 * Everything else is dropped. A third-party image host is refused here for the
 * same reason it is refused in the database: the site's rendering must not
 * depend on a host nobody here controls, and next.config.ts only declares a
 * remote pattern for the one host that is ours.
 *
 * The two rules are stated in both places on purpose. The database's is the
 * one that prevents the value being stored; this one is what keeps the page
 * correct if a row predates that constraint, or arrives from somewhere else.
 */
const CMS_BUCKET_URL =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/unchained-cms-media\/[^\s]+$/;

export function mediaRef(value: unknown): string | undefined {
  const clean = text(value, 500);
  if (!clean) return undefined;

  if (clean.startsWith('/')) {
    // '//host/x' is a protocol-relative URL to somebody else's server, not a
    // path on this site.
    return clean.startsWith('//') ? undefined : clean;
  }

  return CMS_BUCKET_URL.test(clean) ? clean : undefined;
}

/** An absolute http(s) URL, or undefined. */
export function externalUrl(value: unknown): string | undefined {
  const clean = text(value, 300);
  if (!clean) return undefined;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return clean;
}

/** A slug, or undefined. The same pattern every slug column enforces. */
export function slug(value: unknown): string | undefined {
  const clean = text(value, 100);
  if (!clean || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean)) return undefined;
  return clean;
}

/**
 * An ISO calendar date (YYYY-MM-DD), or undefined.
 *
 * PostgREST serialises a `date` column as exactly this, and the site formats
 * it by appending `T00:00:00Z` — so a value in any other shape would produce
 * an Invalid Date rather than a wrong one, which is worse to debug than an
 * absent date.
 *
 * The calendar is checked, not just the pattern: '2026-02-31' matches the
 * shape and is not a day.
 */
export function isoDate(value: unknown): string | undefined {
  const clean = text(value, 10);
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(clean)) return undefined;
  const parsed = new Date(`${clean}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Round-trip: JavaScript rolls 2026-02-31 forward to March, so a date that
  // does not serialise back to itself was never a real calendar day.
  return parsed.toISOString().slice(0, 10) === clean ? clean : undefined;
}

/** A plain object, or null. Arrays are not objects for this purpose. */
export function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
