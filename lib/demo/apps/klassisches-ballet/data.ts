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
  /**
   * In English, like the site itself.
   *
   * The company's name is German; its European debut is being sold to a
   * European audience in English, which is what the site's own navigation
   * (CAST · THE EXPERIENCE · PERFORMANCES · ABOUT) and its call to action
   * ("RESERVE YOUR EVENING") say.
   */
  title: 'The Official Debut Gala',
  eyebrow: 'Official debut gala · 2026',
  venue: 'Historic City Theatre',
  city: 'Wiesbaden',
  tagline: 'One night · One stage · A historic cultural moment',
  lede:
    'The historic European debut of a world-class artistic institution. One extraordinary evening that marks the beginning of a new cultural legacy.',
  /** Offset from the demo anchor date, so the poster never goes stale. */
  dateOffset: 54,
  doors: '18:30',
  curtain: '19:30',
} as const;

/** The site's own navigation, in its own order. */
export const navigation = [
  'Cast',
  'The Experience',
  'Performances',
  'About',
] as const;

export const programme: readonly DemoPiece[] = [
  {
    id: 'p1',
    title: 'Grand Pas Classique',
    composer: 'Auber',
    detail: 'Opening, full ensemble',
    minutes: 12,
  },
  {
    id: 'p2',
    title: 'Swan Lake — The White Act',
    composer: 'Tchaikovsky',
    detail: 'Pas de deux and corps de ballet',
    minutes: 26,
  },
  {
    id: 'p3',
    title: 'Don Quixote — Wedding Pas de Deux',
    composer: 'Minkus',
    detail: 'Principals of the evening',
    minutes: 14,
  },
  {
    id: 'p4',
    title: 'Contemporary Interlude',
    composer: 'World premiere',
    detail: 'Choreographed for this evening alone',
    minutes: 18,
  },
  {
    id: 'p5',
    title: 'Paquita — Finale',
    composer: 'Minkus',
    detail: 'The complete company',
    minutes: 22,
  },
];

export const categories: readonly DemoCategory[] = [
  { id: 'stalls', name: 'Stalls', detail: 'Rows 1–12, centre', price: 9_500 },
  { id: 'circle', name: 'Dress Circle', detail: 'Raised view, side', price: 7_500 },
  { id: 'upper', name: 'Upper Circle', detail: 'Upper tier, unobstructed', price: 4_500 },
  { id: 'box', name: 'Box', detail: 'Four seats, private access', price: 14_000 },
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
  presale: { stalls: 42, circle: 26, upper: 78, box: 6 },
  final: { stalls: 3, circle: 0, upper: 11, box: 0 },
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
