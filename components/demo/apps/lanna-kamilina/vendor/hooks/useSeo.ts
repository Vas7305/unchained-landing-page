import type { SeoInput } from '../types';

/**
 * Declares the head for a page — disabled in the demo.
 *
 * ─── DEMO DIVERGENCE: why this is a no-op here ────────────────────────────
 * In the product this is correct and important: `applySeo` writes
 * `document.title`, the meta description, Open Graph tags, a `<link
 * rel="canonical">` and JSON-LD into the document head, and removes them again
 * on unmount so two pages never contribute contradictory structured data.
 *
 * In a demo panel there is only one document, and it belongs to this website.
 * Left running, opening the demo would retitle the browser tab to the salon's
 * page title, point this page's canonical URL at `lannakamilina.ru`, and inject
 * `HairSalon` structured data into an Unchained Business page. The first is
 * visible; the other two are told to search engines, which is worse — a
 * canonical pointing off-site is an instruction to deindex the page carrying
 * it.
 *
 * So the hook keeps its signature and its call sites and does nothing. The
 * product's `lib/seo.ts` is still vendored, because `BookingPage` imports
 * `breadcrumbSchema` from it to build the input this hook receives — the data
 * is still assembled the way the product assembles it; it is only the write to
 * the head that is withheld.
 */
export function useSeo(_input: SeoInput): void {
  void _input;
}
