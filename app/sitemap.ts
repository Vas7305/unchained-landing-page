import type { MetadataRoute } from 'next';
import { pillars, siteConfig } from '@/lib/site';
import { detailedProjects } from '@/lib/projects';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = ['', '/work', '/journey', ...pillars.map((p) => `/${p.slug}`)];

  const projectRoutes = detailedProjects.map((p) => `/work/${p.slug}`);

  return [...staticRoutes, ...projectRoutes].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency: route === '/journey' ? 'monthly' : 'yearly',
    priority: route === '' ? 1 : route === '/work' ? 0.9 : 0.7,
  }));
}
