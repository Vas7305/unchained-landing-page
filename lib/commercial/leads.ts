import { leadChannelEndpoint, leadEndpoint } from './config';
import type { ChannelKind } from './channels';

/**
 * The project inquiry: what the visitor tells us, and how it becomes a lead.
 *
 * ─── What this file is not ────────────────────────────────────────────────
 * It is not a lead system and it makes no commercial decision. It collects
 * answers, attaches the attribution the browser already knows, and hands all of
 * it to `public.create_public_lead`, which does the only three things that
 * matter and does them where they cannot be tampered with: it validates, it
 * asks the SAME routing function the contact panel asked to decide who owns the
 * inquiry (§14), and it writes the row.
 *
 * There is deliberately no `assigned_commercial_id` in the payload below. The
 * browser knows who was displayed — it is on screen — and sending that id would
 * be handing an anonymous caller the ability to assign every lead in the
 * business to one person. The server re-resolves instead. §14's "one assignment
 * decision" is a property of the database, not a convention this file follows.
 *
 * ─── Friction (§11) ───────────────────────────────────────────────────────
 * Nothing here gates a contact channel. WhatsApp, Telegram, Cal.com and email
 * are live the moment the panel resolves, and this form sits below them for the
 * visitor who would rather write than open an app. A submission is a bonus, not
 * a toll.
 */

/**
 * The service taxonomy, which is the site's own (§13).
 *
 * These are the three capability pillars this website publishes — the same
 * slugs as `lib/pillar-content.ts`, the same slugs as the `/software-
 * development`, `/business-automation` and `/growth-systems` routes, and the
 * same ids seeded into `public.unchained_services`. One vocabulary across the
 * site, the database and the admin panel; a fourth spelling anywhere would be a
 * category that quietly counts nothing.
 *
 * There is no "Other" option. The select's empty value means the visitor did
 * not say, which is recorded as exactly that and never as a service.
 */
export const serviceInterests = [
  'software-development',
  'business-automation',
  'growth-systems',
] as const;

export type ServiceInterest = (typeof serviceInterests)[number];

export function isServiceInterest(value: unknown): value is ServiceInterest {
  return (
    typeof value === 'string' &&
    (serviceInterests as readonly string[]).includes(value)
  );
}

/** What the form holds. Every field is a string, as form fields are. */
export interface InquiryDraft {
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  message: string;
  /** §22: filled only by something that cannot see it. */
  honeypot: string;
}

export const emptyInquiry: InquiryDraft = {
  name: '',
  email: '',
  phone: '',
  company: '',
  service: '',
  message: '',
  honeypot: '',
};

/** Attribution the browser knows and the visitor never types (§12). */
export interface InquiryContext {
  /** ISO 3166-1 alpha-2, or null when detection said nothing. */
  country: string | null;
  language: string;
  /** Path only — see `sourcePage`. */
  page: string | null;
  /** Which CTA opened the panel — see `sourceCta`. */
  cta: string | null;
  /** This attempt's idempotency token (§43). */
  clientToken: string;
}

/**
 * Which field a visitor has to fix, or null when the draft is submittable.
 *
 * Frontend validation is for UX and nothing else (§23): every rule below is
 * enforced again by `create_public_lead`, in the same shape, against a caller
 * that never loaded this page. What it buys is that the visitor is told which
 * box is wrong before a round trip, instead of receiving a flat "invalid".
 */
export type InquiryField = 'name' | 'email' | 'phone' | 'contact' | 'message';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9][0-9 ()./-]{5,31}$/;

export function validateInquiry(draft: InquiryDraft): InquiryField | null {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();

  if (name === '' || name.length > 120) return 'name';
  if (email !== '' && !EMAIL_RE.test(email)) return 'email';
  if (phone !== '' && !PHONE_RE.test(phone)) return 'phone';
  // The one rule that is about the lead rather than about a field: a message
  // nobody can answer is not an inquiry.
  if (email === '' && phone === '') return 'contact';
  if (draft.message.trim().length > 2000) return 'message';

  return null;
}

/**
 * The current path, reduced to what the database will accept.
 *
 * No host, no scheme, no query string and no fragment. Query strings are where
 * campaign parameters, session ids and occasionally an email address ride
 * along, and none of that is needed to answer "which page produced this
 * inquiry" (§12, §20). A path that does not survive the pattern becomes null
 * rather than being repaired — a wrong page is worse than an unknown one.
 */
export function sourcePage(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const path = pathname.split(/[?#]/)[0];
  return /^\/[A-Za-z0-9/_-]{0,199}$/.test(path) ? path : null;
}

/**
 * The CTA label, in the shape §12's example uses: `hero_start_project`.
 *
 * `detail` is the extra context a section passes — which engagement card, which
 * project — and it replaces the generic suffix when present, so the label stays
 * one token that identifies one button.
 */
export function sourceCta(
  source: string | null | undefined,
  detail?: string | null,
): string | null {
  if (!source) return null;
  const label = `${source}_${detail ?? 'start_project'}`
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return /^[a-z][a-z0-9_]{0,63}$/.test(label) ? label : null;
}

/** The exact body sent to `create_public_lead`. Pure, so it can be pinned. */
export function leadPayload(draft: InquiryDraft, context: InquiryContext) {
  const clean = (value: string) => {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  return {
    p_name: draft.name.trim(),
    p_email: clean(draft.email),
    p_phone: clean(draft.phone),
    p_company_name: clean(draft.company),
    p_country_code: context.country,
    p_language: context.language,
    p_service_interest: isServiceInterest(draft.service) ? draft.service : null,
    p_message: clean(draft.message),
    p_source_page: context.page,
    p_source_cta: context.cta,
    p_client_token: context.clientToken,
    p_honeypot: clean(draft.honeypot),
    // ─── Always true, and that is the point ───────────────────────────────
    // This form has exactly one way in: the "Prefer to write?" disclosure,
    // closed by default, below whichever representative the resolver
    // presented. A visitor who opens it has looked at that name and chosen to
    // describe their project instead of starting a conversation.
    //
    // The business rule that follows: a visitor who reached the site from
    // advertising rather than through a representative's work is not that
    // representative's lead merely because the resolver put their name on the
    // screen. Attaching them anyway would overrule the visitor's own decision
    // to skip the consultation. So the lead arrives UNASSIGNED, into the
    // manager's queue, and is routed by a person.
    //
    // Hardcoded rather than threaded through InquiryContext because the
    // toggle is the only entry point — see ProjectInquiryForm. If this form is
    // ever mounted somewhere a representative was NOT offered first, that is
    // the moment to make this a parameter, because the reasoning above stops
    // holding.
    //
    // ─── DEPLOYMENT ORDER MATTERS ─────────────────────────────────────────
    // Migration 20260911000002 must be applied BEFORE this ships. PostgREST
    // resolves an RPC by the exact set of keys in the body, so sending this one
    // to a database that still has the twelve-argument create_public_lead does
    // not "default" anything — it fails to find the function at all, surfaces
    // as PGRST202, and every visitor gets 'unavailable' on a form that looks
    // fine. The old database does not ignore the new key; it rejects the call.
    p_self_service: true,
  };
}

/**
 * What the visitor's browser gets back.
 *
 * Three outcomes and no fourth, because the function returns `{ success }` and
 * at most a coarse reason (§42). A network failure is reported as
 * 'unavailable' rather than as success: telling someone their message was sent
 * when it was not is the one failure mode this form must not have — the contact
 * channels above it are still there, and the panel says so.
 */
export type InquiryResult =
  | { kind: 'sent' }
  | { kind: 'invalid' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable' };

const REQUEST_TIMEOUT_MS = 10_000;

async function post(
  endpoint: { url: string; anonKey: string },
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        apikey: endpoint.anonKey,
        Authorization: `Bearer ${endpoint.anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      // Anonymous, exactly as the resolver call is: no cookies, no credentials,
      // nothing about the visitor riding along that they did not type (§21).
      credentials: 'omit',
      signal: controller.signal,
    });

    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Read the RPC's answer without trusting its shape (§23, and habit). */
export function toInquiryResult(data: unknown): InquiryResult {
  if (typeof data !== 'object' || data === null) return { kind: 'unavailable' };
  const body = data as { success?: unknown; reason?: unknown };
  if (body.success === true) return { kind: 'sent' };
  if (body.reason === 'rate_limited') return { kind: 'rate_limited' };
  if (body.reason === 'invalid') return { kind: 'invalid' };
  return { kind: 'unavailable' };
}

export async function submitInquiry(
  draft: InquiryDraft,
  context: InquiryContext,
): Promise<InquiryResult> {
  if (!leadEndpoint) return { kind: 'unavailable' };

  try {
    const data = await post(
      leadEndpoint,
      leadPayload(draft, context),
      REQUEST_TIMEOUT_MS,
    );
    if (data === null) return { kind: 'unavailable' };
    return toInquiryResult(data);
  } catch {
    // Network failure, abort, timeout, malformed JSON. The panel keeps the
    // form's contents and the channels stay live, so nothing is lost.
    return { kind: 'unavailable' };
  }
}

/**
 * Attach a channel click to the lead this visitor just created (§19, §44).
 *
 * Fire-and-forget on purpose: the visitor is on their way to WhatsApp and must
 * not wait for, or be blocked by, an analytics write. Every failure is
 * swallowed — a lost event is a gap in a report; a delayed link is a lost
 * conversation.
 *
 * Called only when a token exists. A visitor who never submitted the form has
 * nothing to attach the click to, and §44 is explicit that the answer there is
 * to leave it anonymous rather than invent a person for it.
 */
export function recordChannelClick(
  clientToken: string | null,
  channel: ChannelKind,
): void {
  if (!clientToken || !leadChannelEndpoint) return;

  void post(
    leadChannelEndpoint,
    { p_client_token: clientToken, p_channel: channel },
    // Shorter than a form submission: nothing depends on the answer, and the
    // page may be leaving.
    3_000,
  ).catch(() => undefined);
}

/**
 * A fresh idempotency token (§43).
 *
 * `crypto.randomUUID` is available in every browser this site supports and in
 * Node 19+, so the fallback exists for one case only: a non-secure context,
 * where it is absent. Math.random is not a good source of uniqueness, which is
 * why it is the fallback and not the implementation — and the consequence of a
 * collision here is bounded, because the token guards against a double-click,
 * not against an attacker.
 */
export function newClientToken(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
