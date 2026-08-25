/**
 * Portfolio data model.
 *
 * This file is the single source of truth for everything the site says about
 * our work. Adding a project here automatically adds it to the homepage grid,
 * to /work, and — when `detailed` is true — gives it a page at /work/<slug>.
 *
 * CONTENT RULE: never add an `outcome` we cannot substantiate. Capability
 * language ("launch-ready platform", "production marketplace architecture") is
 * always preferable to an invented metric.
 *
 * The five in-development entries below are intentionally unnamed. We publish
 * a project's name, story and detail page when it ships — not before. Replace
 * `title` / `category` / `description` as each one becomes public.
 */

export type ProjectStatus =
  | 'completed'
  | 'in-development'
  | 'concept'
  | 'internal';

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

export const projects: Project[] = [
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
    title: 'Project 02',
    slug: 'project-02',
    description:
      'A web application currently in active development. We publish the detail when it launches.',
    category: 'Web Application',
    status: 'in-development',
    year: '2026',
  },
  {
    title: 'Project 03',
    slug: 'project-03',
    description:
      'A business automation system currently in active development. We publish the detail when it launches.',
    category: 'Business Automation',
    status: 'in-development',
    year: '2026',
  },
  {
    title: 'Project 04',
    slug: 'project-04',
    description:
      'A digital platform currently in active development. We publish the detail when it launches.',
    category: 'Digital Platform',
    status: 'in-development',
    year: '2026',
  },
  {
    title: 'Project 05',
    slug: 'project-05',
    description:
      'A growth system currently in active development. We publish the detail when it launches.',
    category: 'Growth Systems',
    status: 'in-development',
    year: '2026',
  },
  {
    title: 'Project 06',
    slug: 'project-06',
    description:
      'A software product currently in active development. We publish the detail when it launches.',
    category: 'Custom Software',
    status: 'in-development',
    year: '2026',
  },
];

export const featuredProject = projects.find((p) => p.featured);

export const otherProjects = projects.filter((p) => !p.featured);

export const detailedProjects = projects.filter((p) => p.detailed);

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function countByStatus(status: ProjectStatus): number {
  return projects.filter((p) => p.status === status).length;
}
