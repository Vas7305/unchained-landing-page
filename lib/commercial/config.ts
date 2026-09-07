import { siteConfig } from '@/lib/site';
import { contactChannels, type Channel, type ChannelSource } from './channels';

/**
 * Build-time configuration for the routing interface.
 *
 * Two things are configured here and nothing else: WHERE to ask the question,
 * and WHO to offer when the answer is nobody. Neither is a routing decision —
 * the resolver makes all of those — and no representative's details appear in
 * this file or anywhere else in the repository (§57).
 *
 * ─── Why the anon key is a public value ───────────────────────────────────
 * These are `NEXT_PUBLIC_*` values, inlined into the client bundle at build
 * time, so anything here is readable by anyone who opens it; there is no
 * "secret" a browser can keep. The Supabase anon
 * key is designed for exactly that, and it is safe HERE specifically because
 * of what Phase 5 did to the database: the four commercial tables carry an
 * `is_super_admin()` RLS policy each and grant anon nothing at all, so this
 * key opens exactly the doors listed below — among them EXECUTE on
 * `public.resolve_commercial_contact(text, text)`, which answers with one row
 * and cannot be made to answer with two. See section E of docs/commercial-
 * routing.md.
 *
 * Missing configuration is not an error state. `resolverEndpoint` is simply
 * null, every inquiry takes the global fallback path, and the visitor still
 * has a way to reach the company — which is §22 and §30's requirement, and
 * the correct behaviour for a preview deploy that has no database.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface ResolverEndpoint {
  url: string;
  anonKey: string;
}

/**
 * The validated project base, or null. One place decides whether a database is
 * configured at all, so no two endpoints can disagree about it.
 */
function readBase(): { url: string; anonKey: string } | null {
  const url = supabaseUrl?.trim().replace(/\/+$/, '');
  const anonKey = supabaseAnonKey?.trim();
  if (!url || !anonKey) return null;

  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return { url, anonKey };
}

const base = readBase();

/**
 * One RPC endpoint, or null when no database is configured.
 *
 * Exported because this file is where the site decides whether it has a
 * database at all, and that decision must not be made twice. lib/portfolio.ts
 * builds its own endpoint through this rather than re-reading the environment,
 * so a URL this file rejects cannot be accepted over there — which is the
 * property `readBase()` was written for and which a second copy would break.
 *
 * That it lives under commercial/ is history: this was the first module to
 * need a database. Nothing here is commercial-specific.
 */
export function rpcEndpoint(name: string): ResolverEndpoint | null {
  return base ? { url: `${base.url}/rest/v1/rpc/${name}`, anonKey: base.anonKey } : null;
}

export const resolverEndpoint: ResolverEndpoint | null = rpcEndpoint(
  'resolve_commercial_contact',
);

/**
 * The RPCs this website is able to call, and there are exactly four. The
 * fourth, `list_public_projects`, is built in lib/portfolio.ts because it is
 * that module's contract rather than this one's; it is named here so this
 * comment stays the complete list.
 *
 * Phase 7 adds two write operations to what was a read-only public surface, so
 * the same reasoning the header applies to the resolver has to hold for them:
 *
 *   · `create_public_lead` inserts nothing the caller chooses. It takes the
 *     visitor's own answers, resolves the commercial ITSELF through the same
 *     routing function, and returns `{ success }` — no lead id, no
 *     representative, no routing metadata (§9, §14, §42).
 *   · `record_public_lead_channel_click` takes the opaque token the browser
 *     generated for its own inquiry and a channel name. An unknown token is a
 *     silent no-op, so it cannot be used to discover whether a lead exists
 *     (§44).
 *
 * Neither grants the anon key any table access: `unchained_leads` and
 * `unchained_lead_events` revoke every privilege from anon and carry SELECT-only
 * policies, so the complete set of things this key can do to the lead tables is
 * "call these two functions". See section E of docs/lead-capture.md.
 */
export const leadEndpoint: ResolverEndpoint | null = rpcEndpoint('create_public_lead');

export const leadChannelEndpoint: ResolverEndpoint | null = rpcEndpoint(
  'record_public_lead_channel_click',
);

/**
 * The global fallback contact (§22).
 *
 * "The fallback contact must come from a configured global contact or existing
 * public contact mechanism. Do not invent one." So this is assembled from two
 * sources and no third: the booking URL the site has always published, and
 * optional environment overrides for a company-wide inbox or number. Nothing
 * is defaulted to a plausible-looking address — an unconfigured channel is
 * absent, and the panel says so rather than offering a link into the void.
 *
 * Every value goes through the same validation the resolver's answer does, so
 * a typo in an environment variable produces a missing button, not a broken
 * one.
 */
const fallbackSource: ChannelSource = {
  whatsapp_number: process.env.NEXT_PUBLIC_FALLBACK_WHATSAPP ?? null,
  telegram_username: process.env.NEXT_PUBLIC_FALLBACK_TELEGRAM ?? null,
  email: process.env.NEXT_PUBLIC_FALLBACK_EMAIL ?? null,
  calcom_url:
    process.env.NEXT_PUBLIC_FALLBACK_BOOKING_URL ?? siteConfig.bookingUrl,
};

export const fallbackChannels: Channel[] = contactChannels(fallbackSource);
