/**
 * Lazara Sersa demo fixtures.
 *
 * A makeup artist's portfolio: the work, the services, and the diary that
 * decides which dates an enquiry can name.
 *
 * ─── On the "photographs" ─────────────────────────────────────────────────
 * There are none, and there is a reason. A portfolio for a working artist is
 * their actual images, and neither publishing those on our site nor filling
 * the grid with stock photographs of somebody else's face would be honest
 * (§7). The tiles are generated marks — see components/demo/ui/DemoArtwork —
 * captioned with invented, obviously generic titles. What the demo is
 * demonstrating is the browsing, filtering and enquiry system around a
 * gallery, which is the part we built.
 */

export const disciplines = [
  'Beauty',
  'Editorial',
  'Fashion',
  'Bridal',
] as const;

export type Discipline = (typeof disciplines)[number];

export interface DemoWork {
  id: string;
  title: string;
  discipline: Discipline;
  year: number;
  /** One line of context, shown in the lightbox. */
  note: string;
}

export const works: readonly DemoWork[] = [
  { id: 'w-01', title: 'Study in Bronze', discipline: 'Beauty', year: 2026, note: 'Skin-first beauty look, single-source light.' },
  { id: 'w-02', title: 'Paper Petals', discipline: 'Editorial', year: 2026, note: 'Sculptural editorial story, six-page feature.' },
  { id: 'w-03', title: 'Runway 04', discipline: 'Fashion', year: 2025, note: 'Twelve looks, forty minutes, one team.' },
  { id: 'w-04', title: 'Morning Veil', discipline: 'Bridal', year: 2026, note: 'Long-wear bridal for a coastal ceremony.' },
  { id: 'w-05', title: 'Graphite Line', discipline: 'Editorial', year: 2025, note: 'Graphic liner series, shot on film.' },
  { id: 'w-06', title: 'Second Skin', discipline: 'Beauty', year: 2025, note: 'Campaign test for a skincare launch.' },
  { id: 'w-07', title: 'Atelier', discipline: 'Fashion', year: 2026, note: 'Lookbook for an independent label.' },
  { id: 'w-08', title: 'Quiet Gold', discipline: 'Bridal', year: 2025, note: 'Warm neutral palette, natural light.' },
  { id: 'w-09', title: 'Nocturne', discipline: 'Editorial', year: 2024, note: 'Night editorial, high-contrast grade.' },
  { id: 'w-10', title: 'Glass', discipline: 'Beauty', year: 2026, note: 'Dewy finish study for a beauty title.' },
  { id: 'w-11', title: 'Cut Silk', discipline: 'Fashion', year: 2024, note: 'Backstage coverage, two-day show.' },
  { id: 'w-12', title: 'First Light', discipline: 'Bridal', year: 2026, note: 'Early-call bridal party of five.' },
];

export interface DemoService {
  id: string;
  name: string;
  detail: string;
  /** Price in cents. */
  from: number;
}

export const servicesOffered: readonly DemoService[] = [
  { id: 'bridal', name: 'Bridal', detail: 'Trial, day-of application and touch-up kit.', from: 45_000 },
  { id: 'editorial', name: 'Editorial & campaign', detail: 'Day rate, agency or direct booking.', from: 65_000 },
  { id: 'fashion', name: 'Fashion & runway', detail: 'Show work, team briefing and key looks.', from: 90_000 },
  { id: 'lesson', name: 'Private lesson', detail: 'Two hours, your own products.', from: 18_000 },
];

/**
 * Days already committed, as offsets from the demo's anchor date.
 *
 * The enquiry form refuses these and offers the nearest free date instead,
 * which is the behaviour a real diary needs and a deterministic failure a
 * visitor can reach on purpose (§20).
 */
export const bookedOffsets: readonly number[] = [2, 3, 8, 9, 10, 15];

/** How far ahead the enquiry form will accept a date. */
export const ENQUIRY_WINDOW_DAYS = 28;

export function findWork(id: string): DemoWork | undefined {
  return works.find((work) => work.id === id);
}

export function findService(id: string): DemoService | undefined {
  return servicesOffered.find((service) => service.id === id);
}

/** The next free date on or after `offset`, or null within the window. */
export function nextFreeOffset(offset: number): number | null {
  for (let candidate = offset; candidate < ENQUIRY_WINDOW_DAYS; candidate++) {
    if (!bookedOffsets.includes(candidate)) return candidate;
  }
  return null;
}
