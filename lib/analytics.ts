/**
 * Minimal, dependency-free analytics dispatch.
 *
 * Events are pushed to `window.dataLayer` and forwarded to gtag / Plausible /
 * Umami if any of them are present. If no provider is installed this is a
 * silent no-op, so it is always safe to call. Adding a provider later requires
 * no changes to the components that fire events.
 */

export type AnalyticsEvent =
  | 'start_project_click'
  | 'explore_work_click'
  | 'follow_journey_click'
  | 'project_click'
  | 'tancerca_view'
  | 'booking_cta_click'
  | 'scroll_depth'
  | 'language_change'
  // ── Commercial routing (Phase 6) ──────────────────────────────────────────
  // `start_project_click` above stays exactly as it was, so the funnel that
  // already exists keeps counting. These four describe what happens AFTER the
  // click, which was previously a redirect no one could measure.
  //
  // §34: none of them carries personal data. Language and a `country_known`
  // boolean are the only things known about the visitor that are ever sent —
  // never the country itself, never a representative's name, number, handle or
  // address, and never anything resembling a location.
  | 'project_cta_clicked'
  | 'commercial_routing_success'
  | 'commercial_routing_fallback'
  | 'contact_channel_clicked'
  // ── Lead capture (Phase 7) ────────────────────────────────────────────────
  // Fired when the optional inquiry form is accepted by the server. §34: it
  // carries the language, whether a country was determined, which CTA the
  // panel was opened from and whether a service was chosen — and nothing the
  // visitor typed. No name, address, company, phone number or message reaches
  // an analytics provider; those exist in one place, behind RLS.
  | 'project_inquiry_submitted';

type Props = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  dataLayer?: Record<string, unknown>[];
  gtag?: (...args: unknown[]) => void;
  plausible?: (event: string, options?: { props?: Props }) => void;
  umami?: { track: (event: string, props?: Props) => void };
};

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === 'undefined') return;

  const w = window as AnalyticsWindow;

  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...props });

  w.gtag?.('event', event, props);
  w.plausible?.(event, { props });
  w.umami?.track(event, props);
}

