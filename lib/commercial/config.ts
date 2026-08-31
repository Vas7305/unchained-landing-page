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
 * The site is a static export, so anything it holds is readable by anyone who
 * opens the bundle; there is no "secret" a browser can keep. The Supabase anon
 * key is designed for exactly that, and it is safe HERE specifically because
 * of what Phase 5 did to the database: the four commercial tables carry an
 * `is_super_admin()` RLS policy each and grant anon nothing at all, so this
 * key opens exactly one door — EXECUTE on
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

function readEndpoint(): ResolverEndpoint | null {
  const url = supabaseUrl?.trim().replace(/\/+$/, '');
  const anonKey = supabaseAnonKey?.trim();
  if (!url || !anonKey) return null;

  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return {
    url: `${url}/rest/v1/rpc/resolve_commercial_contact`,
    anonKey,
  };
}

export const resolverEndpoint: ResolverEndpoint | null = readEndpoint();

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
