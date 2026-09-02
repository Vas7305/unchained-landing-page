import { describe, expect, it } from 'vitest';
import { metadata as indexMetadata } from './page';
import ArticlePage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from './[slug]/page';
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

  it('is left indexable', () => {
    expect(indexMetadata.robots).toBeUndefined();
  });
});

describe('/insights/[slug]', () => {
  it('generates a route for every published article and nothing else', () => {
    // Empty today, because nothing is published yet.
    expect(generateStaticParams()).toEqual([]);
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
