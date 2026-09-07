/**
 * Portfolio data model, and the portfolio the site falls back to.
 *
 * ─── This file is no longer the source of truth ───────────────────────────
 * It was, until public.unchained_projects existed. The portfolio is now
 * entered and published in the admin panel, and the site reads it through
 * lib/portfolio.ts — which is why nothing here is exported as a ready-made
 * list any more. `featuredProject`, `otherProjects` and `detailedProjects`
 * were module constants computed at import time; a constant cannot represent
 * an answer that arrives from a database, and leaving them in place would have
 * meant half the site rendering the file while the other half rendered the
 * table.
 *
 * What is left is the two things that genuinely belong in code:
 *
 *   · the TYPE and the status vocabulary, which the components are written
 *     against and which the database's CHECK constraint mirrors;
 *   · the SELECTORS, which are pure functions over a list and are applied to
 *     whichever list the caller has — the seven below or the seven that came
 *     back from the RPC.
 *
 * ─── What `fallbackProjects` is for ───────────────────────────────────────
 * A build with no database behind it — a preview deploy, a local checkout with
 * no .env, a moment when Supabase is unreachable — still has to render a
 * portfolio, because an agency site with an empty Our Work section says
 * something false about the agency. So the site falls back to this list, which
 * is the transcription seeded into the table by
 * supabase/migrations/20260907000002_unchained_projects.sql.
 *
 * It is a floor, not a mirror. It will drift from the table the first time
 * somebody edits a project in the panel, and that is expected: its job is to
 * be a truthful portfolio, not the current one. See lib/portfolio.ts for the
 * three cases that reach it and the one — a successful answer of zero rows —
 * that deliberately does not.
 *
 * CONTENT RULE: never add an `outcome` we cannot substantiate. Capability
 * language ("launch-ready platform", "production marketplace architecture") is
 * always preferable to an invented metric. The rule now lives in two places,
 * on this array and on the `outcome` column, because content can be written in
 * either.
 */

export type ProjectStatus =
  | 'completed'
  | 'in-development'
  | 'concept'
  | 'internal'
  | 'dismissed';

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string; description: string }
> = {
  completed: {
    label: 'Completed',
    className: 'text-emerald-400/90 border-emerald-400/25 bg-emerald-400/5',
    description: 'Built, shipped and live.',
  },
  'in-development': {
    label: 'In Development',
    className: 'text-amber-300/90 border-amber-300/25 bg-amber-300/5',
    description: 'Currently being designed and built.',
  },
  concept: {
    label: 'Concept',
    className: 'text-sky-300/90 border-sky-300/25 bg-sky-300/5',
    description: 'Defined and validated, not yet in build.',
  },
  internal: {
    label: 'Internal Product',
    className: 'text-violet-300/90 border-violet-300/25 bg-violet-300/5',
    description: 'Built and owned by Unchained Business.',
  },
  dismissed: {
    label: 'Dismissed',
    className: 'text-red-400/90 border-red-400/25 bg-red-400/5',
    description: 'No longer being pursued.',
  },
};

export type Project = {
  title: string;
  slug: string;
  description: string;
  category: string;
  status: ProjectStatus;
  featured?: boolean;
  /** Whether this project has enough published detail to warrant /work/<slug>. */
  detailed?: boolean;
  year?: string;
  industry?: string;
  services?: string[];
  technologies?: string[];
  thumbnail?: string;
  /**
   * Intrinsic pixel size of `thumbnail`. Only needed where the image is shown
   * uncropped (the flagship card): it lets the element be sized to the artwork
   * instead of to its frame, so rounding follows the screenshot's own edges
   * rather than the letterbox around it.
   */
  thumbnailSize?: { width: number; height: number };
  heroImage?: string;
  summary?: string;
  challenge?: string;
  solution?: string;
  /** What the project proves we can build. Used instead of invented metrics. */
  capabilities?: string[];
  /**
   * Honest outcome. Where there is no measured commercial result yet, this
   * describes the state of the deliverable, not a business claim.
   */
  outcome?: string;
  externalUrl?: string;
};

export const fallbackProjects: Project[] = [
  {
    title: 'TanCerca',
    slug: 'tancerca',
    description:
      'A marketplace and digital commerce platform designed and developed by Unchained Business.',
    category: 'Marketplace Platform',
    status: 'completed',
    featured: true,
    detailed: true,
    year: '2026',
    industry: 'Local commerce & delivery',
    thumbnail: '/work/tancerca.webp',
    thumbnailSize: { width: 747, height: 546 },
    heroImage: '/work/tancerca-hero.webp',
    externalUrl: 'https://www.tancercadeti.com',
    services: [
      'Product architecture',
      'Product design',
      'Full-stack development',
      'Operational systems',
    ],
    technologies: [
      'Next.js',
      'TypeScript',
      'PostgreSQL',
      'Payments',
      'PWA',
      'Cloud infrastructure',
    ],
    summary:
      'TanCerca is our first completed flagship product: a marketplace connecting local merchants with nearby customers, including the merchant tooling, delivery coordination and payment infrastructure the marketplace runs on.',
    challenge:
      'A marketplace is not one product — it is three, and they have to work in sync. Merchants need tooling that fits how they actually run a shop. Customers need an experience fast and simple enough to use one-handed. And the operation between them needs orders, delivery and money to move reliably without someone manually holding it together. Building all three as one coherent system, rather than three disconnected apps, was the core problem.',
    solution:
      'We designed the platform around a single domain model shared by every surface, then built outward: merchant dashboards for catalogue, orders and fulfilment; a consumer PWA built for repeat use and low-bandwidth conditions; and the operational layer underneath — payments, subscriptions, referrals, delivery coordination and reporting. Every part was specified before it was built, which is the same sequence we apply to client work.',
    capabilities: [
      'Marketplace architecture',
      'Merchant systems & dashboards',
      'Consumer experience (PWA)',
      'Delivery infrastructure',
      'Subscriptions & payments',
      'Referral systems',
      'Backend infrastructure',
      'Operational workflows',
    ],
    outcome:
      'A launch-ready, full-stack commerce platform running in production — the most complete demonstration of what we can build end to end.',
  },
  {
    title: 'Lanna Kamilina',
    slug: 'lanna-kamilina',
    description:
      'A Russian-language site for a beauty salon open in central Moscow since 1999 — service catalogue, master profiles, work gallery and online booking with live availability.',
    category: 'Salon & Booking Website',
    status: 'in-development',
    year: '2026',
    industry: 'Beauty & personal care',
    thumbnail: '/work/lanna-kamilina.webp',
  },
  {
    title: 'Lazara Sersa Makeup Artist',
    slug: 'lazara-sersa',
    description:
      'A brand and portfolio site for a makeup artist working across beauty, editorial, fashion and celebrity work.',
    category: 'Portfolio Website',
    status: 'in-development',
    year: '2026',
    industry: 'Beauty & editorial',
    thumbnail: '/work/lazara-sersa.webp',
  },
  {
    title: 'Klassisches Ballet',
    slug: 'klassisches-ballet',
    description:
      'A launch and reservation site for the official European debut gala of a classical ballet company — a single-night cultural event.',
    category: 'Event Website',
    status: 'dismissed',
    year: '2025',
    industry: 'Performing arts & culture',
    thumbnail: '/work/klassisches-ballet.webp',
  },
  {
    title: 'Mensalere',
    slug: 'mensalere',
    description:
      'A platform connecting people with psychology professionals for private online consultations, with professional profiles and online appointment booking.',
    category: 'Online Consultation Platform',
    status: 'in-development',
    year: '2026',
    industry: 'Mental health & wellbeing',
    thumbnail: '/work/mensalere.webp',
  },
  {
    title: 'Frito',
    slug: 'frito',
    description:
      'A mobile dating app for meeting new people in Cuba, with the marketing and download site behind its iOS and Android launch.',
    category: 'Mobile App',
    status: 'in-development',
    year: '2026',
    industry: 'Social & dating',
    thumbnail: '/work/frito.webp',
  },
  {
    title: 'Unchained OS',
    slug: 'unchained-os',
    description:
      'Our own private equity operating system: deal analysis and comparison, pipeline CRM, capital allocation, multi-investor management and fund performance tracking.',
    category: 'Internal Software',
    status: 'in-development',
    year: '2026',
    industry: 'Private equity & investment operations',
    thumbnail: '/work/unchained-os.webp',
  },
];

/**
 * The flagship, or nothing.
 *
 * `find` rather than `filter`, as before — but the ambiguity a second flagship
 * would create is now settled upstream: idx_unchained_projects_one_featured
 * makes two featured rows impossible, so this can no longer silently pick one
 * of several. Over `fallbackProjects` the same guarantee is held by review.
 */
export function featuredOf(list: readonly Project[]): Project | undefined {
  return list.find((p) => p.featured);
}

/** Most recent first. Entries without a year sort last; equal years keep
 *  their incoming order, so the caller's list still controls tie-breaks —
 *  which for the database is display_order, applied by list_public_projects().
 */
function byYearDesc(a: Project, b: Project): number {
  const ya = a.year ? Number(a.year) : Number.NEGATIVE_INFINITY;
  const yb = b.year ? Number(b.year) : Number.NEGATIVE_INFINITY;
  return yb - ya;
}

/** Everything but the flagship, newest first. */
export function othersOf(list: readonly Project[]): Project[] {
  return list.filter((p) => !p.featured).sort(byYearDesc);
}

/** The projects with enough published detail to warrant /work/<slug>. */
export function detailedOf(list: readonly Project[]): Project[] {
  return list.filter((p) => p.detailed);
}

/** One project by slug, or nothing. */
export function findProject(
  list: readonly Project[],
  slug: string,
): Project | undefined {
  return list.find((p) => p.slug === slug);
}
