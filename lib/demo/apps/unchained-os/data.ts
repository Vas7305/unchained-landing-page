/**
 * Unchained OS demo fixtures.
 *
 * A fund, its pipeline and its committed positions. Every company here is
 * invented, and deliberately dull: generic sector names, round numbers and no
 * resemblance to a real target. This is our own internal system, so the
 * temptation to show the actual pipeline was real — and the actual pipeline is
 * confidential deal flow about other people's businesses, which is the single
 * most obviously unpublishable dataset in this portfolio (§7, §22).
 *
 * All money is in cents.
 */

export type Stage =
  | 'Sourced'
  | 'Screening'
  | 'Diligence'
  | 'IC'
  | 'Committed'
  | 'Passed';

/** The order deals move through. `Passed` is an exit, not a step. */
export const STAGE_ORDER: readonly Stage[] = [
  'Sourced',
  'Screening',
  'Diligence',
  'IC',
  'Committed',
];

export const sectors = [
  'B2B Software',
  'Healthcare Services',
  'Industrial',
  'Consumer',
  'Logistics',
] as const;

export interface DemoDeal {
  id: string;
  name: string;
  sector: string;
  geography: string;
  stage: Stage;
  /** What the company is asking for, in cents. */
  ask: number;
  /** Trailing twelve-month revenue, in cents. */
  revenue: number;
  /** Year-on-year revenue growth, as a fraction. */
  growth: number;
  /** EBITDA margin, as a fraction. Negative is allowed and informative. */
  margin: number;
  /** Enterprise value as a multiple of revenue. */
  multiple: number;
  /** Years the business has been trading. */
  age: number;
  thesis: string;
}

export const deals: readonly DemoDeal[] = [
  {
    id: 'd-01',
    name: 'Northwind Analytics',
    sector: 'B2B Software',
    geography: 'Spain',
    stage: 'Diligence',
    ask: 4_200_000_00,
    revenue: 3_100_000_00,
    growth: 0.62,
    margin: 0.14,
    multiple: 4.1,
    age: 6,
    thesis:
      'Reporting layer for mid-market retail groups. Retention is the story; the sales motion is not yet repeatable.',
  },
  {
    id: 'd-02',
    name: 'Meridian Care',
    sector: 'Healthcare Services',
    geography: 'Portugal',
    stage: 'IC',
    ask: 6_500_000_00,
    revenue: 8_900_000_00,
    growth: 0.21,
    margin: 0.19,
    multiple: 2.2,
    age: 11,
    thesis:
      'Outpatient clinic group with three sites and a fourth under lease. Buy-and-build with a clear operator.',
  },
  {
    id: 'd-03',
    name: 'Halden Components',
    sector: 'Industrial',
    geography: 'Germany',
    stage: 'Screening',
    ask: 9_000_000_00,
    revenue: 14_200_000_00,
    growth: 0.06,
    margin: 0.11,
    multiple: 1.4,
    age: 24,
    thesis:
      'Precision parts supplier, founder retiring. Cheap for a reason: single-customer concentration above 40%.',
  },
  {
    id: 'd-04',
    name: 'Solvane Logistics',
    sector: 'Logistics',
    geography: 'Netherlands',
    stage: 'Diligence',
    ask: 5_400_000_00,
    revenue: 11_600_000_00,
    growth: 0.28,
    margin: 0.09,
    multiple: 1.8,
    age: 9,
    thesis:
      'Last-mile operator with its own routing software. The software is the asset; the fleet is the liability.',
  },
  {
    id: 'd-05',
    name: 'Verba Learning',
    sector: 'B2B Software',
    geography: 'Italy',
    stage: 'Sourced',
    ask: 2_800_000_00,
    revenue: 1_400_000_00,
    growth: 0.94,
    margin: -0.08,
    multiple: 6.3,
    age: 3,
    thesis:
      'Compliance training platform growing fast on one channel. Unprofitable and priced as if it were not.',
  },
  {
    id: 'd-06',
    name: 'Casa Nostra Foods',
    sector: 'Consumer',
    geography: 'Italy',
    stage: 'Screening',
    ask: 3_600_000_00,
    revenue: 6_800_000_00,
    growth: 0.12,
    margin: 0.16,
    multiple: 1.6,
    age: 17,
    thesis:
      'Regional brand with real shelf presence. Growth is a distribution question, not a product one.',
  },
  {
    id: 'd-07',
    name: 'Atlas Facilities',
    sector: 'Industrial',
    geography: 'Spain',
    stage: 'IC',
    ask: 7_200_000_00,
    revenue: 12_400_000_00,
    growth: 0.17,
    margin: 0.13,
    multiple: 1.5,
    age: 14,
    thesis:
      'Facilities management with contracted recurring revenue and a fragmented market to consolidate.',
  },
  {
    id: 'd-08',
    name: 'Pentacle Health',
    sector: 'Healthcare Services',
    geography: 'France',
    stage: 'Passed',
    ask: 5_000_000_00,
    revenue: 4_100_000_00,
    growth: 0.09,
    margin: 0.04,
    multiple: 3.2,
    age: 8,
    thesis:
      'Passed at screening: reimbursement exposure concentrated in one region under active review.',
  },
];

/** The fund the console is opened on. */
export const fund = {
  name: 'Unchained Fund I',
  /** Total committed capital, in cents. */
  size: 40_000_000_00,
  /** Already deployed into the existing portfolio, in cents. */
  deployed: 22_500_000_00,
  /** The smallest cheque the fund will write, in cents. */
  minimumCheque: 500_000_00,
  vintage: 2024,
} as const;

/** Existing positions, for the dashboard's portfolio view. */
export const portfolio: readonly {
  name: string;
  invested: number;
  value: number;
}[] = [
  { name: 'Corvus Systems', invested: 6_000_000_00, value: 9_400_000_00 },
  { name: 'Delta Rail Services', invested: 8_500_000_00, value: 10_100_000_00 },
  { name: 'Fiora Retail Group', invested: 5_000_000_00, value: 4_300_000_00 },
  { name: 'Quill Media', invested: 3_000_000_00, value: 5_800_000_00 },
];

/** Net asset value by quarter, oldest first, in cents. Drives the chart. */
export const navSeries: readonly number[] = [
  18_200_000_00, 19_100_000_00, 21_400_000_00, 22_000_000_00,
  24_800_000_00, 26_300_000_00, 27_900_000_00, 29_600_000_00,
];

export const investors: readonly {
  name: string;
  committed: number;
  called: number;
}[] = [
  { name: 'Anchor LP', committed: 15_000_000_00, called: 8_400_000_00 },
  { name: 'Family Office A', committed: 10_000_000_00, called: 5_600_000_00 },
  { name: 'Family Office B', committed: 8_000_000_00, called: 4_500_000_00 },
  { name: 'GP Commitment', committed: 7_000_000_00, called: 4_000_000_00 },
];

export function findDeal(id: string): DemoDeal | undefined {
  return deals.find((deal) => deal.id === id);
}

/**
 * The screening score, 0–100.
 *
 * Four weighted components, computed rather than stored, so a deal cannot
 * carry a score that disagrees with its own numbers — which is exactly the
 * failure mode of the spreadsheet this product replaced. The weights are
 * arbitrary but fixed: the point of the demo is that comparison is consistent,
 * not that this is anybody's real investment committee model.
 */
export function scoreOf(deal: DemoDeal): number {
  const growth = Math.min(deal.growth / 0.8, 1) * 30;
  const margin = Math.min(Math.max(deal.margin, 0) / 0.25, 1) * 25;
  // Cheaper is better, so the multiple is inverted against a 7× ceiling.
  const price = Math.min(Math.max(7 - deal.multiple, 0) / 6, 1) * 25;
  const durability = Math.min(deal.age / 20, 1) * 20;

  return Math.round(growth + margin + price + durability);
}

/** `$12.4M`, the way a fund console writes it. */
export function usdM(cents: number): string {
  const millions = cents / 100 / 1_000_000;
  const decimals = Math.abs(millions) >= 10 ? 1 : 2;
  return `$${millions.toFixed(decimals)}M`;
}
