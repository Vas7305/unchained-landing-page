/**
 * Analytics abstraction.
 *
 * Components call `track('booking_started', {...})` and know nothing else.
 * Sinks (Yandex.Metrica, GA4, a warehouse endpoint) are registered once at
 * startup, so swapping providers never touches a component.
 */

export type AnalyticsEvent =
  | 'page_viewed'
  | 'hero_cta_clicked'
  | 'discovery_started'
  | 'discovery_answered'
  | 'discovery_completed'
  | 'look_viewed'
  | 'portfolio_viewed'
  | 'before_after_interacted'
  | 'service_viewed'
  | 'specialist_viewed'
  | 'price_viewed'
  | 'availability_opened'
  | 'booking_started'
  | 'booking_step_completed'
  | 'booking_completed'
  | 'booking_failed'
  | 'phone_clicked'
  | 'telegram_clicked'
  | 'whatsapp_clicked'
  | 'map_clicked'
  | 'nav_clicked';

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsRecord {
  event: AnalyticsEvent;
  payload: AnalyticsPayload;
  at: number;
  /** Acquisition context, attached automatically to every event. */
  context: AnalyticsContext;
}

export interface AnalyticsContext {
  path: string;
  source?: string;
  campaign?: string;
  landing?: string;
}

export type AnalyticsSink = (record: AnalyticsRecord) => void;

const sinks: AnalyticsSink[] = [];
/** Events fired before any sink is registered are replayed on registration. */
const buffer: AnalyticsRecord[] = [];
const MAX_BUFFER = 100;

let context: AnalyticsContext = { path: '/' };

export function setAnalyticsContext(next: Partial<AnalyticsContext>): void {
  context = { ...context, ...next };
}

export function getAnalyticsContext(): AnalyticsContext {
  return context;
}

export function registerSink(sink: AnalyticsSink): () => void {
  sinks.push(sink);
  buffer.forEach(sink);
  return () => {
    const index = sinks.indexOf(sink);
    if (index >= 0) sinks.splice(index, 1);
  };
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  const record: AnalyticsRecord = { event, payload, at: Date.now(), context };

  if (sinks.length === 0) {
    buffer.push(record);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    return;
  }
  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      /* A broken sink must never break the page. */
    }
  }
}

/** Development sink — makes the funnel visible while building. */
export const consoleSink: AnalyticsSink = (record) => {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.info(
    `%c▸ ${record.event}`,
    'color:#8e6a4c;font-weight:600',
    record.payload,
    record.context.path,
  );
};

/**
 * Yandex.Metrica sink. Metrica is the dominant analytics product in Russia;
 * this stays inert until a counter id is configured, so nothing is sent by
 * accident during development.
 */
export function createMetricaSink(counterId: number): AnalyticsSink {
  return (record) => {
    const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
    if (typeof ym !== 'function') return;
    ym(counterId, 'reachGoal', record.event, record.payload);
  };
}

/** dataLayer sink for GTM/GA4, should the salon run one. */
export const dataLayerSink: AnalyticsSink = (record) => {
  const w = window as unknown as { dataLayer?: unknown[] };
  if (!Array.isArray(w.dataLayer)) return;
  w.dataLayer.push({ event: record.event, ...record.payload });
};
