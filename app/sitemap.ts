import type { MetadataRoute } from 'next';
import { pillars, siteConfig } from '@/lib/site';
import { detailedOf } from '@/lib/projects';
import { loadProjects } from '@/lib/portfolio';
import { demoPath, hasDemo } from '@/lib/demo/registry';
import { insightPath, publishedInsights } from '@/lib/insights';

/**
 * Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. See app/page.tsx.
 *
 * This replaces `dynamic = 'force-static'`, which said the same thing about
 * this route — no request-time input — but pinned the output to build time.
 * The project pages below now come from a database, so a portfolio published
 * in the panel has to be able to reach the sitemap without a redeploy. The
 * route is still statically rendered and CDN-cached; it is regenerated on the
 * same schedule as the pages it lists, so the two cannot drift apart by more
 * than one interval.
 */
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = [
    '',
    '/work',
    '/journey',
    '/insights',
    ...pillars.map((p) => `/${p.slug}`),
  ];

  const detailed = detailedOf(await loadProjects());

  const projectRoutes = detailed.map((p) => `/work/${p.slug}`);

  // Demo routes follow the same indexing rule the pages themselves apply: a
  // project with enough published detail to warrant a landing page has a demo
  // worth submitting too, and one without it is reachable but not indexed. Both
  // conditions are read rather than restated — `detailed` from the database,
  // `hasDemo` from the code — so this list cannot claim a demo that does not
  // exist or a project that was unpublished.
  const demoRoutes = detailed.flatMap((p) =>
    hasDemo(p.slug) ? [demoPath(p.slug)] : [],
  );

  // Drafts are excluded by `publishedInsights`, so an unfinished article is
  // never submitted for indexing.
  const insightRoutes = publishedInsights.map((a) => insightPath(a.slug));

  return [
    ...staticRoutes,
    ...projectRoutes,
    ...demoRoutes,
    ...insightRoutes,
  ].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency:
      route === '/journey' || route === '/insights' ? 'monthly' : 'yearly',
    priority: route === '' ? 1 : route === '/work' ? 0.9 : 0.7,
  }));
}
