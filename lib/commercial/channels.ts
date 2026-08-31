/**
 * Turning the resolver's answer into the links that actually reach a person.
 *
 * ─── Why the shapes live here and not in JSX ──────────────────────────────
 * §18-§21: no phone number, handle or booking URL may be written into a
 * component. Every destination on this site is derived, at render time, from
 * what `resolve_commercial_contact` returned for this visitor.
 *
 * The three transformations below are the entire reason this is a module.
 * A stored WhatsApp number is `+79991234567` but wa.me wants `79991234567`
 * with no plus; a stored Telegram handle is bare but the URL needs `t.me/` in
 * front; a booking URL is used verbatim because inventing one produces a page
 * that either 404s or belongs to somebody else. Written inline they would be
 * written slightly differently in each place, and the version that leaves the
 * plus in silently opens an empty chat.
 *
 * This is a deliberate twin of admin-panel/src/features/commercial/channels.ts.
 * It is NOT shared code and NOT business logic: the routing decision — who
 * receives the inquiry — is made once, in the database. This file only knows
 * how to spell a URL, which is a presentation concern that each app owns.
 *
 * ─── Everything here treats its input as hostile (§42) ────────────────────
 * The resolver's response arrives over the network from a database an
 * administrator types into. A malformed value must produce NO button, never a
 * broken or dangerous one — so each builder validates and returns null, and
 * `contactChannels` returns only the channels that came back non-null. A
 * caller renders the array it is handed and cannot produce a dead button by
 * forgetting a null check (§17: "No dead buttons").
 */

/** The four channels, and the order §17 asks them to be offered in. */
export type ChannelKind = 'whatsapp' | 'telegram' | 'calcom' | 'email';

export interface Channel {
  kind: ChannelKind;
  /** Ready to use as an href. Already validated. */
  href: string;
}

/** The nullable stored fields a channel can be built from. */
export interface ChannelSource {
  whatsapp_number?: string | null;
  telegram_username?: string | null;
  email?: string | null;
  calcom_url?: string | null;
}

/** E.164: '+', a non-zero country digit, then 7-15 digits in total. */
const E164_RE = /^\+[1-9][0-9]{6,14}$/;
/** Telegram's own rule: 5-32 of letters, digits and underscore. */
const TELEGRAM_RE = /^[A-Za-z0-9_]{5,32}$/;
/** Deliberately loose: reject "not an address", not "not RFC 5322". */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * wa.me takes the number in E.164 order WITHOUT the leading '+'.
 *
 * Nothing is repaired here. A number that is missing its country code is not
 * guessed at — the admin panel refuses to store one, and a value that somehow
 * reached us anyway yields no button rather than a call to a stranger.
 */
export function whatsappHref(number: string | null | undefined): string | null {
  if (!number) return null;
  const value = number.trim();
  if (!E164_RE.test(value)) return null;
  return `https://wa.me/${value.slice(1)}`;
}

/** t.me takes the bare username, which is exactly what the resolver returns. */
export function telegramHref(
  username: string | null | undefined,
): string | null {
  if (!username) return null;
  const handle = username.trim();
  if (!TELEGRAM_RE.test(handle)) return null;
  return `https://t.me/${handle}`;
}

export function emailHref(email: string | null | undefined): string | null {
  if (!email) return null;
  const address = email.trim();
  if (!EMAIL_RE.test(address)) return null;
  return `mailto:${address}`;
}

/**
 * The stored booking URL, used as-is (§21).
 *
 * Only checked for being an absolute https URL — which is also what stops a
 * `javascript:` or `data:` value from ever reaching an href. §21: not every
 * representative has a Cal.com page, and none is invented for the ones who
 * do not.
 */
export function bookingHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  try {
    if (new URL(value).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return value;
}

/**
 * Every channel that is actually reachable, in the order §17 prescribes:
 * WhatsApp, Telegram, Schedule a Call, Email — direct conversation first,
 * because that is how a commercial conversation actually starts, and email
 * last because it is the one that waits.
 *
 * Returns [] when nothing is reachable. That is a real state — a contact
 * whose channels are all blank or malformed — and the caller treats it the
 * same way it treats "no regional contact at all" (§17 last clause), because
 * to the visitor the two are the same thing.
 */
export function contactChannels(source: ChannelSource): Channel[] {
  const built: [ChannelKind, string | null][] = [
    ['whatsapp', whatsappHref(source.whatsapp_number)],
    ['telegram', telegramHref(source.telegram_username)],
    ['calcom', bookingHref(source.calcom_url)],
    ['email', emailHref(source.email)],
  ];

  return built.flatMap(([kind, href]) => (href ? [{ kind, href }] : []));
}
