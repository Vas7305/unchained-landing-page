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
 *     whichever list the caller has — the eight below or however many came
 *     back from the RPC.
 *
 * ─── What `fallbackProjects` is for ───────────────────────────────────────
 * A build with no database behind it — a preview deploy, a local checkout with
 * no .env, a moment when Supabase is unreachable — still has to render a
 * portfolio, because an agency site with an empty Our Work section says
 * something false about the agency. So the site falls back to this list, which
 * is the transcription seeded into the table by
 * supabase/migrations/20260907000002_unchained_projects.sql, plus every
 * project added by a later migration alongside its row —
 * 20260907000003_unchained_projects_vectorforge.sql being the first.
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

import type { Localized } from '@/lib/cms/localized';
import type { SeoFields } from '@/lib/cms/seo';

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

/**
 * The fields of a project that a translator writes.
 *
 * Everything NOT in this list is a fact about the work rather than about a
 * language — the slug, the images, the year, the status, the flagship flag —
 * and is the same in every locale. See the header of
 * supabase/migrations/20260912000001_unchained_cms_core.sql for why the slug in
 * particular is not translated: the site has one URL per project, so a
 * localized slug would have nowhere to be used.
 *
 * Expressed as a key list rather than a second interface so it cannot drift
 * from `Project` itself.
 */
export type ProjectCopy = Pick<
  Project,
  | 'title'
  | 'description'
  | 'category'
  | 'industry'
  | 'summary'
  | 'challenge'
  | 'solution'
  | 'outcome'
  | 'services'
  | 'technologies'
  | 'capabilities'
  | 'thumbnailAlt'
  | 'heroImageAlt'
  | 'seo'
>;

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
   * What the thumbnail shows, for a reader who cannot see it.
   *
   * Per-usage rather than per-file: the same screenshot is "the TanCerca
   * merchant dashboard" here and "an example of the dashboards we build" in an
   * article. The media library holds a default that the panel copies in when
   * the image is chosen; this is the value that reaches the page.
   */
  thumbnailAlt?: string;
  /**
   * Intrinsic pixel size of `thumbnail`. Only needed where the image is shown
   * uncropped (the flagship card): it lets the element be sized to the artwork
   * instead of to its frame, so rounding follows the screenshot's own edges
   * rather than the letterbox around it.
   */
  thumbnailSize?: { width: number; height: number };
  heroImage?: string;
  /** What the hero image shows. See `thumbnailAlt`. */
  heroImageAlt?: string;
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
  /**
   * Editor-written SEO overrides. Absent means "derive it from the content",
   * which is what the site did before the CMS had these fields and is still
   * the right default. See lib/cms/seo.ts for the fallback chain.
   */
  seo?: SeoFields;
  /**
   * The same project in the other five languages, each holding only the fields
   * that were actually translated.
   *
   * Carried in the payload rather than fetched per language because the site
   * prerenders one URL per project and switches language on the client — see
   * lib/cms/localized.ts. Absent on a project nobody has translated, which is
   * every project in `fallbackProjects`: that list is a floor for a build with
   * no database, and a hand-maintained six-language copy of it would be a
   * second content system.
   */
  translations?: Localized<ProjectCopy>;
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
  {
    title: 'VectorForge',
    slug: 'vector-forge',
    description:
      'A desktop asset production workstation we built for our own work: it traces raster artwork into clean vector files, retouches and compresses images, and generates the complete icon and favicon packages every launch needs — processed entirely on the machine.',
    category: 'Desktop Application',
    status: 'internal',
    detailed: true,
    year: '2026',
    industry: 'Design tooling & asset production',
    thumbnail: '/work/vector-forge.png',
    services: [
      'Product architecture',
      'Product design',
      'Desktop application development',
      'Release engineering',
    ],
    technologies: [
      'Tauri 2',
      'Rust',
      'React',
      'TypeScript',
      'Zustand',
      'Vite',
    ],
    summary:
      'VectorForge is the asset pipeline behind our own projects: a Windows desktop application that converts raster artwork into production-ready SVG, retouches and optimises images, and produces the full icon, favicon and web-asset packages a site or app launch requires — with every file processed on the machine rather than uploaded to a service.',
    challenge:
      'Every project we ship needs the same set of assets: a logo as clean SVG, favicons at a dozen sizes, application icons per platform, images compressed without being degraded. Producing them meant a chain of free web converters and one-off scripts — brand artwork uploaded to services we do not control, settings nobody recorded, and output that differed depending on who prepared it and on what day. It was slow on every project, and it was never twice the same.',
    solution:
      'We built the pipeline as a desktop application. A Rust core does the work — raster-to-vector tracing in four tuned modes (logo, icon, illustration, precision), SVG rendering and optimisation, classical image adjustments, and icon-set generation — while a React interface keeps every setting visible and every result reviewable before it is committed. Projects keep their assets, versions and lineage on disk, so an enhancement is a new version rather than an overwritten file; a batch queue applies one recipe to a whole folder; and export produces a validated ZIP with a manifest instead of a folder assembled by hand. It ships as a signed Windows installer on its own update channel.',
    capabilities: [
      'Desktop applications (Tauri + Rust)',
      'Raster-to-vector tracing',
      'Native image processing',
      'Icon & favicon generation',
      'Batch job orchestration',
      'Offline-first architecture',
      'Signed installers & auto-update',
      'Design system implementation',
    ],
    outcome:
      'A shipped 1.0 in daily use: the tool that now produces the vector, icon and favicon assets behind the rest of this portfolio, running offline on the machine that holds the artwork.',
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
