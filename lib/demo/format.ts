/**
 * Deterministic formatting for demo surfaces.
 *
 * ─── Why not Intl directly in the components ──────────────────────────────
 * Two reasons, and the second is the one that bites. The first is consistency:
 * a currency written three ways in one demo reads as three different products.
 * The second is hydration — `Intl.NumberFormat` resolves against the runtime's
 * locale data, and the server's ICU build and the browser's do not always
 * agree on a space, a narrow no-break space or a symbol position. React then
 * reports a mismatch on text nobody chose. Fixing the locale per call, as
 * every function here does, removes the disagreement.
 *
 * ─── And why no live clock ────────────────────────────────────────────────
 * Nothing here reads `Date.now()`. A demo whose fixtures say "today" would
 * render one date on the prerendered server pass and another in a browser in a
 * different timezone, and a screenshot taken of it would rot. Demo dates are
 * offsets from a fixed anchor the fixtures declare, so the same demo shows the
 * same week forever.
 */

/**
 * The day every demo calendar is anchored to.
 *
 * A Monday, deliberately: booking demos that lay out a week read correctly
 * starting from one, and the weekday of a slot is then a property of the
 * fixture rather than of the day somebody opened the page.
 */
export const DEMO_ANCHOR_DATE = new Date(Date.UTC(2026, 8, 14));

/** `offsetDays` days after the anchor, at UTC midnight. */
export function demoDate(offsetDays: number): Date {
  return new Date(DEMO_ANCHOR_DATE.getTime() + offsetDays * 86_400_000);
}

/** An amount in minor units (cents) as text. */
export function money(
  minorUnits: number,
  currency: string,
  locale: string,
  { decimals = 2 }: { decimals?: number } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minorUnits / 100);
}

/** A whole number with thousands separators. */
export function count(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** A ratio as a percentage, one decimal at most. */
export function percent(value: number, locale: string, decimals = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** A short weekday-and-day label, e.g. `Mon 14`. */
export function dayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** A full date, e.g. `14 September 2026`. */
export function longDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * A stable hue for a name.
 *
 * Used by the shared avatar and by demo tiles that need to look like distinct
 * things without shipping an image for each. Same input, same colour, on every
 * render and on both sides of hydration.
 */
export function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 360;
}

/** One or two initials from a display name. */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
