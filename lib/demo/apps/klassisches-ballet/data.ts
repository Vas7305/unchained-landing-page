/**
 * Klassisches Ballett demo fixtures.
 *
 * A single-night gala: the programme, the price categories and how many seats
 * are left in each. The company, the venue, the dancers and the dates are
 * invented — the project itself was not pursued, and inventing a real
 * company's European debut would be worse than inventing a fictional one.
 *
 * Prices in cents.
 */

export interface DemoPiece {
  id: string;
  title: string;
  composer: string;
  detail: string;
  minutes: number;
}

export interface DemoCategory {
  id: string;
  name: string;
  detail: string;
  /** Price in cents. */
  price: number;
}

export const gala = {
  title: 'Europäisches Debüt-Gala',
  venue: 'Historisches Stadttheater',
  city: 'Wiesbaden',
  /** Offset from the demo anchor date, so the poster never goes stale. */
  dateOffset: 54,
  doors: '18:30',
  curtain: '19:30',
} as const;

export const programme: readonly DemoPiece[] = [
  {
    id: 'p1',
    title: 'Grand Pas Classique',
    composer: 'Auber',
    detail: 'Eröffnung, Ensemble',
    minutes: 12,
  },
  {
    id: 'p2',
    title: 'Schwanensee — Weißer Akt',
    composer: 'Tschaikowski',
    detail: 'Pas de deux und Corps de ballet',
    minutes: 26,
  },
  {
    id: 'p3',
    title: 'Don Quijote — Hochzeits-Pas-de-deux',
    composer: 'Minkus',
    detail: 'Solisten des Abends',
    minutes: 14,
  },
  {
    id: 'p4',
    title: 'Zeitgenössisches Zwischenspiel',
    composer: 'Uraufführung',
    detail: 'Choreografie eigens für diesen Abend',
    minutes: 18,
  },
  {
    id: 'p5',
    title: 'Paquita — Finale',
    composer: 'Minkus',
    detail: 'Gesamtes Ensemble',
    minutes: 22,
  },
];

export const categories: readonly DemoCategory[] = [
  { id: 'parkett', name: 'Parkett', detail: 'Reihe 1–12, mittig', price: 9_500 },
  { id: 'rang-1', name: 'Erster Rang', detail: 'Erhöhte Sicht, seitlich', price: 7_500 },
  { id: 'rang-2', name: 'Zweiter Rang', detail: 'Oberer Rang, freie Sicht', price: 4_500 },
  { id: 'loge', name: 'Loge', detail: 'Vier Plätze, eigener Zugang', price: 14_000 },
];

/**
 * Seats left, per scenario.
 *
 * The `endspurt` scenario is not a different demo — it is the same evening
 * later in its sale, which is when a ticketing system's behaviour is actually
 * interesting: two categories gone, one nearly gone, and an order that has to
 * be refused rather than confirmed and apologised for afterwards.
 */
export const remainingByScenario: Record<string, Record<string, number>> = {
  vorverkauf: { parkett: 42, 'rang-1': 26, 'rang-2': 78, loge: 6 },
  endspurt: { parkett: 3, 'rang-1': 0, 'rang-2': 11, loge: 0 },
};

/** The house limit on one reservation. */
export const MAX_PER_ORDER = 6;

/** Handling fee per reservation, in cents. */
export const HANDLING_FEE = 350;

export function findCategory(id: string): DemoCategory | undefined {
  return categories.find((category) => category.id === id);
}

export function remainingFor(scenarioId: string): Record<string, number> {
  return remainingByScenario[scenarioId] ?? remainingByScenario.vorverkauf;
}

export const totalRuntime = programme.reduce(
  (sum, piece) => sum + piece.minutes,
  0,
);
