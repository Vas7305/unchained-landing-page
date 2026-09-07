import { describe, expect, it } from 'vitest';
import { metadata as indexMetadata } from './page';
import ArticlePage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from './[slug]/page';
import sitemap from '@/app/sitemap';
import {
  getPublishedInsight,
  insightPath,
  publishedInsights,
} from '@/lib/insights';
import { SITE_OG_IMAGE, absoluteUrl } from '@/lib/metadata';
import {
  ORGANIZATION_ID,
  articleSchema,
  breadcrumbSchema,
  organizationSchema,
} from '@/lib/structured-data';
import { siteConfig } from '@/lib/site';

/**
 * The routes themselves: what URLs exist, what metadata they emit, and what
 * happens to a slug nobody wrote. Rendering is not covered here — the project
 * has no DOM test environment and this module does not add one — so these
 * exercise the parts of a route that are plain functions.
 */

describe('/insights', () => {
  it('carries its own title, description and canonical', () => {
    expect(indexMetadata.title).toBe('Insights');
    expect(indexMetadata.description).toBeTruthy();
    expect(indexMetadata.description).not.toBe(siteConfig.description);
    expect(indexMetadata.alternates?.canonical).toBe('/insights');
  });

  it('carries its own Open Graph block rather than the homepage’s', () => {
    const og = indexMetadata.openGraph as {
      title?: unknown;
      description?: unknown;
      url?: unknown;
      images?: unknown;
    };
    expect(og.title).toBe(`Insights — ${siteConfig.name}`);
    expect(og.description).toBe(indexMetadata.description);
    expect(og.url).toBe(`${siteConfig.url}/insights`);
    expect(og.images).toEqual(['/opengraph-image']);
  });

  it('is left indexable', () => {
    expect(indexMetadata.robots).toBeUndefined();
  });
});

describe('/insights/[slug]', () => {
  it('generates a route for every published article and nothing else', () => {
    expect(generateStaticParams()).toEqual(
      publishedInsights.map((a) => ({ slug: a.slug })),
    );
    expect(generateStaticParams()).toContainEqual({
      slug: 'custom-software-or-saas',
    });
  });

  it('refuses slugs it did not generate', () => {
    // Without this, a draft or a mistyped URL would render a page.
    expect(dynamicParams).toBe(false);
  });

  it('answers an unknown slug with not-found rather than a page', async () => {
    await expect(
      ArticlePage({ params: Promise.resolve({ slug: 'never-written' }) }),
    ).rejects.toThrow();
  });

  it('does not fall back to homepage metadata for an unknown slug', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'never-written' }),
    });

    expect(meta.title).toBe('Article not found');
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });
});

/**
 * The first published article, as the route actually serves it: the metadata
 * Next.js emits, the two JSON-LD entities the page renders, and the sitemap
 * entry. Everything here comes from the Module 3 builders — the route adds no
 * metadata or schema of its own.
 */
describe('/insights/custom-software-or-saas', () => {
  const slug = 'custom-software-or-saas';
  const article = getPublishedInsight(slug)!;
  const path = insightPath(slug);

  it('emits the article’s own metadata', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug }) });
    const og = meta.openGraph as {
      title?: unknown;
      description?: unknown;
      url?: unknown;
      images?: unknown;
      type?: unknown;
      publishedTime?: unknown;
    };

    expect(meta.title).toBe(article.title);
    expect(meta.description).toBe(article.description);
    expect(meta.alternates?.canonical).toBe(path);
    expect(og.title).toBe(`${article.title} — ${siteConfig.name}`);
    expect(og.description).toBe(article.description);
    expect(og.url).toBe(`${siteConfig.url}${path}`);
    expect(og.images).toEqual([SITE_OG_IMAGE]);
    expect(og.type).toBe('article');
    expect(og.publishedTime).toBe(article.publishedAt);
    expect((meta.twitter as { card?: string }).card).toBe(
      'summary_large_image',
    );
    expect(meta.twitter?.title).toBe(og.title);
    expect(meta.twitter?.description).toBe(article.description);
    expect(meta.robots).toBeUndefined();
  });

  it('describes itself as one Article, published by the one Organization', () => {
    const schema = articleSchema(article);

    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe(article.title);
    expect(schema.description).toBe(article.description);
    expect(schema.datePublished).toBe(article.publishedAt);
    expect(schema.dateModified).toBe(article.publishedAt);
    expect(schema.url).toBe(`${siteConfig.url}${path}`);
    expect(schema.image).toBe(absoluteUrl(SITE_OG_IMAGE));

    // Publisher and author resolve to the site's single Organization node —
    // no second organization, and no invented person.
    for (const entity of [schema.publisher, schema.author]) {
      expect(entity).toMatchObject({
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
      });
    }
    expect(organizationSchema()['@id']).toBe(ORGANIZATION_ID);
    expect(schema.person).toBeUndefined();
  });

  it('publishes a Home → Insights → Article trail', () => {
    const crumbs = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Insights', path: '/insights' },
      { name: article.title, path },
    ]);
    const items = crumbs.itemListElement as Record<string, unknown>[];

    expect(items.map((i) => i.name)).toEqual([
      'Home',
      'Insights',
      article.title,
    ]);
    expect(items.map((i) => i.item)).toEqual([
      `${siteConfig.url}/`,
      `${siteConfig.url}/insights`,
      `${siteConfig.url}${path}`,
    ]);
  });

  // Async since the sitemap's project routes come from the portfolio. With no
  // Supabase configured here, that resolves to `fallbackProjects` — the same
  // not-configured path app/routes.metadata.test.ts documents.
  it('is submitted for indexing', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`${siteConfig.url}${path}`);
    expect(urls).toContain(`${siteConfig.url}/insights`);
    expect(urls).toContain(`${siteConfig.url}/software-development`);
  });
});
