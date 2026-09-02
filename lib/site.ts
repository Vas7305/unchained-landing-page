export const siteConfig = {
  name: 'Unchained Business',
  url: 'https://www.unchainedbusiness.com',
  tagline: 'Digital Infrastructure for Businesses Ready to Grow',
  description:
    'Unchained Business builds digital infrastructure for growing businesses — software, websites, business automation and growth systems. See what we are building.',
  /**
   * The company-wide booking link.
   *
   * No longer where "Start a Project" points: since Phase 6 that CTA asks the
   * commercial resolver who should receive the inquiry, and booking is one of
   * the channels the assigned representative may offer. This URL is now the
   * global fallback (Phase 6 §22) — the existing public contact mechanism the
   * panel falls back to when no regional representative can be determined —
   * and can be overridden per deployment with NEXT_PUBLIC_FALLBACK_BOOKING_URL.
   * See lib/commercial/config.ts.
   */
  bookingUrl: 'https://cal.com',
  social: {
    twitter: '#',
    linkedin: '#',
    instagram: '#',
  },
} as const;

/** The three capability pillars, shared by the homepage and the pillar pages. */
export const pillars = [
  {
    number: '01',
    slug: 'software-development',
    title: 'Software Development',
    summary:
      'Digital products and business systems built around the way your business actually operates.',
    items: [
      'Websites',
      'Web Applications',
      'SaaS',
      'Custom Software',
      'Digital Products',
    ],
  },
  {
    number: '02',
    slug: 'business-automation',
    title: 'Business Automation',
    summary:
      'Eliminate repetitive work, connect your tools, and turn manual processes into systems.',
    items: [
      'Workflow Automation',
      'Integrations',
      'Internal Tools',
      'Operational Systems',
    ],
  },
  {
    number: '03',
    slug: 'growth-systems',
    title: 'Growth Systems',
    summary:
      'Build structured systems that turn attention, leads, and customer interactions into predictable opportunities.',
    items: [
      'Client Acquisition',
      'Lead Qualification',
      'Nurturing',
      'Conversion Systems',
    ],
  },
] as const;

export type Pillar = (typeof pillars)[number];

/** A pillar's slug — the site's only pillar taxonomy, reused by every layer. */
export type PillarSlug = Pillar['slug'];

/**
 * The pillar a slug names. Throws rather than returning undefined: `PillarSlug`
 * already guarantees the entry exists, so a miss here means `pillars` and the
 * type went out of sync, which is a bug and not a rendering condition.
 */
export function getPillar(slug: PillarSlug): Pillar {
  const pillar = pillars.find((p) => p.slug === slug);
  if (!pillar) throw new Error(`Unknown pillar: ${slug}`);
  return pillar;
}
