import { contactChannels, type Channel } from './channels';
import { fallbackChannels, resolverEndpoint } from './config';

/**
 * The public website's one question: "who should receive this inquiry?"
 *
 * ─── What this file is not ────────────────────────────────────────────────
 * §12, §24 and §49: there is ONE routing algorithm and it is
 * `public.resolve_commercial_contact(country, language)`, defined in
 * supabase/migrations/20260901000002_resolve_commercial_contact.sql. Nothing
 * here ranks, filters, prefers or substitutes a representative. The country
 * and the language go out; one contact or nothing comes back. A line of the
 * form `if (country === 'RU') …` in this repository would be a second source
 * of truth, and a bug the day an administrator changes anything.
 *
 * That is also what makes the admin panel and this website incapable of
 * disagreeing: both call the same function, so a change to a priority, a
 * language or an active flag takes effect on the next inquiry with no
 * redeployment of this site (§55).
 *
 * ─── Why fetch and not @supabase/supabase-js ──────────────────────────────
 * One RPC over PostgREST is one POST. The client library would add tens of
 * kilobytes to a landing page whose dependency list is deliberately short, and
 * every capability it brings — auth, realtime, storage, table queries — is one
 * this site must specifically NOT have (§45, §46, §47). The narrow call is
 * also the auditable one: what follows is the complete set of database
 * operations the public website is able to perform.
 */

/** What the contact panel needs to introduce someone and reach them. */
export interface AssignedCommercial {
  name: string;
  role: string | null;
  channels: Channel[];
}

/**
 * Why the visitor is seeing the global fallback. For analytics and nothing
 * else — §22 and §30 require all four to look identical on screen, because
 * "the resolver timed out" is not a sentence a prospective client should read.
 */
export type FallbackReason =
  | 'no_contact'
  | 'no_channels'
  | 'request_failed'
  | 'not_configured';

export type RoutingOutcome =
  | { kind: 'commercial'; commercial: AssignedCommercial }
  | { kind: 'fallback'; reason: FallbackReason; channels: Channel[] };

/** The columns the RPC returns. Every one of them is untrusted (§42). */
interface ResolverRow {
  name?: unknown;
  role?: unknown;
  email?: unknown;
  whatsapp_number?: unknown;
  telegram_username?: unknown;
  calcom_url?: unknown;
}

const REQUEST_TIMEOUT_MS = 8000;

/** Long enough to be a real name, short enough not to be a paragraph. */
const NAME_MAX = 120;

/**
 * Control characters, zero-width characters and bidirectional overrides.
 *
 * Written as escapes rather than pasted so the class survives a re-encoding of
 * this file, and so it is readable: C0 and DEL, then the zero-width and
 * directional-mark range, the line/paragraph separators, and the bidi
 * embedding controls.
 */
const UNDISPLAYABLE =
  /[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/**
 * A displayable string, or null.
 *
 * These characters are stripped rather than escaped because the risk is not
 * markup injection — React escapes output already — but a stored name carrying
 * a newline or a bidi override that rearranges the sentence around it on
 * screen. A representative's name is one line of text; anything that would
 * make it behave otherwise is not part of the name.
 */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(UNDISPLAYABLE, ' ').replace(/\s+/g, ' ').trim();
  return clean === '' ? null : clean.slice(0, max);
}

function fallback(reason: FallbackReason): RoutingOutcome {
  return { kind: 'fallback', reason, channels: fallbackChannels };
}

/**
 * Turn a response row into an outcome.
 *
 * A row without a usable name is not a contact: the panel's whole promise is
 * "here is who you will speak with", and an unnamed card cannot keep it. A row
 * with a name but no reachable channel is not a contact either (§17's closing
 * clause) — there would be nothing to press. Both become the fallback, which
 * is the one state that always has somewhere to send the visitor.
 */
export function toOutcome(row: ResolverRow | null | undefined): RoutingOutcome {
  if (!row || typeof row !== 'object') return fallback('no_contact');

  const name = text(row.name, NAME_MAX);
  if (!name) return fallback('no_contact');

  const asString = (value: unknown) =>
    typeof value === 'string' ? value : null;

  const channels = contactChannels({
    whatsapp_number: asString(row.whatsapp_number),
    telegram_username: asString(row.telegram_username),
    email: asString(row.email),
    calcom_url: asString(row.calcom_url),
  });
  if (channels.length === 0) return fallback('no_channels');

  return {
    kind: 'commercial',
    commercial: { name, role: text(row.role, NAME_MAX), channels },
  };
}

/**
 * The request body. Exactly two fields (§11).
 *
 * No visitor identity, no `commercial_id`, no priority, no preference — there
 * is no parameter through which a caller could ask for a particular person,
 * because the function does not accept one. The visitor cannot select their
 * representative because there is nothing to select with.
 *
 * An undetermined country is sent as null rather than omitted or invented
 * (§23): the RPC normalises null and '' alike and answers with no regional
 * contact, whereas a plausible-looking guess would route the inquiry to a
 * country the visitor is not in.
 */
export function requestBody(country: string | null, language: string) {
  return {
    p_country_code: country,
    p_language: language,
  };
}

async function request(
  country: string | null,
  language: string,
): Promise<RoutingOutcome> {
  if (!resolverEndpoint) return fallback('not_configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(resolverEndpoint.url, {
      method: 'POST',
      headers: {
        apikey: resolverEndpoint.anonKey,
        Authorization: `Bearer ${resolverEndpoint.anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody(country, language)),
      // No cookies and no credentials: this is an anonymous public question,
      // and nothing about the visitor should ride along with it (§25, §45).
      credentials: 'omit',
      signal: controller.signal,
    });

    if (!res.ok) return fallback('request_failed');

    // A set-returning function comes back as an array of rows — zero rows for
    // every "no contact" outcome, which the RPC deliberately does not
    // distinguish from one another.
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return fallback('request_failed');

    return toOutcome(data[0] as ResolverRow | undefined);
  } catch {
    // Network failure, abort, timeout, malformed JSON — §30: one graceful
    // state, and no Supabase, RPC, HTTP or database detail reaches the
    // visitor.
    return fallback('request_failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * In-flight and completed requests, keyed by the pair that produced them.
 *
 * §33: the key carries country AND language, so one pair's answer can never be
 * shown for another. §26: within a page, four CTAs and a reopened panel share
 * a single request; a language change is a different key and therefore a
 * genuinely new question (§27). The map is module state, so it dies with the
 * page — nothing is cached indefinitely, and nothing is written to storage
 * where it could outlive an administrator's change (§55).
 */
const cache = new Map<string, Promise<RoutingOutcome>>();

export function routingCacheKey(
  country: string | null,
  language: string,
): string {
  return `commercial-routing:${country ?? '-'}:${language}`;
}

export function resolveCommercial(
  country: string | null,
  language: string,
): Promise<RoutingOutcome> {
  const key = routingCacheKey(country, language);

  let pending = cache.get(key);
  if (!pending) {
    // `request` already converts every failure into a fallback; the catch is
    // belt and braces so a rejected promise can never be cached and replayed.
    pending = request(country, language).catch(() =>
      fallback('request_failed'),
    );
    cache.set(key, pending);
  }

  return pending;
}

/** Test seam. Never called by the app. */
export function resetRoutingCache(): void {
  cache.clear();
}
