import type { MetadataRoute } from 'next';
import { pillars, siteConfig } from '@/lib/site';
import { detailedProjects } from '@/lib/projects';
import { insightPath, publishedInsights } from '@/lib/insights';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = [
    '',
    '/work',
    '/journey',
    '/insights',
    ...pillars.map((p) => `/${p.slug}`),
  ];

  const projectRoutes = detailedProjects.map((p) => `/work/${p.slug}`);

  // Drafts are excluded by `publishedInsights`, so an unfinished article is
  // never submitted for indexing.
  const insightRoutes = publishedInsights.map((a) => insightPath(a.slug));

  return [...staticRoutes, ...projectRoutes, ...insightRoutes].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency:
      route === '/journey' || route === '/insights' ? 'monthly' : 'yearly',
    priority: route === '' ? 1 : route === '/work' ? 0.9 : 0.7,
  }));
}
