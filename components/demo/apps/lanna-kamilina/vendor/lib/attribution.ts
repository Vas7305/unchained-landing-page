import type { Attribution } from '../types';

/**
 * Acquisition context.
 *
 * A visitor arriving from a VK post about a blonde transformation should still
 * be recognisable as such three pages later, at the moment they book. The
 * first landing URL and its campaign parameters are captured once per session
 * and never overwritten — last-touch would erase exactly the signal that
 * matters for a salon buying traffic.
 */

const KEY = 'lk.attribution';

/**
 * DEMO DIVERGENCE — the product keeps acquisition context in `sessionStorage`
 * so a visitor arriving from a VK campaign is still recognisable as such at
 * the moment they book. A demo has no campaign to attribute and no business
 * touching the visitor's session storage, so the store is a plain object.
 *
 * `captureAttribution` is never called here — it lives in the product's
 * `main.tsx`, which the demo does not mount — so this stays empty and
 * `readAttribution` answers `{}`, exactly as it does on a visitor's first
 * pageview in the real application.
 */
const session = new Map<string, string>();

export function captureAttribution(): Attribution {
  const existing = readAttribution();
  if (existing.source || existing.campaign) return existing;

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    source: params.get('utm_source') ?? params.get('from') ?? inferSource(document.referrer),
    campaign: params.get('utm_campaign') ?? undefined,
    landing: window.location.pathname,
  };

  session.set(KEY, JSON.stringify(attribution));
  return attribution;
}

export function readAttribution(): Attribution {
  try {
    const raw = session.get(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

/** Referrer buckets that reflect how Moscow actually finds a salon. */
function inferSource(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('yandex')) return 'yandex';
    if (host.includes('google')) return 'google';
    if (host.includes('2gis')) return '2gis';
    if (host.includes('vk.com')) return 'vk';
    if (host.includes('t.me') || host.includes('telegram')) return 'telegram';
    if (host.includes('instagram')) return 'instagram';
    return host;
  } catch {
    return undefined;
  }
}
