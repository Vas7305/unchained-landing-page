import { describe, expect, it } from 'vitest';
import {
  buildInsightMetadata,
  formatInsightDate,
  getPublishedInsight,
  insightPath,
  insights,
  insightsForPillar,
  isPublished,
  publishedInsights,
  resolveRelated,
  type InsightArticle,
} from './insights';
import { getPillar, pillars, siteConfig } from './site';

/**
 * The collection is empty at this stage, so the checks that guard the content
 * itself (unique slugs, real pillar references) pass vacuously today and start
 * doing work the moment the first article is written. Everything with
 * behaviour to verify now — the publishing gate, slug resolution, the related
 * links, the metadata — is exercised against fixtures declared here. These are
 * test data, not content: nothing below is rendered, indexed or published.
 */

const pillarSlugs = pillars.map((p) => p.slug) as string[];

function fixture(overrides: Partial<InsightArticle> = {}): InsightArticle {
  return {
    slug: 'fixture-article',
    title: 'Fixture Article',
    description: 'A fixture used by the tests.',
    lede: 'A fixture used by the tests.',
    publishedAt: '2026-01-15',
    pillar: 'software-development',
    sections: [{ heading: 'Fixture', body: ['Fixture paragraph.'] }],
    ...overrides,
  };
}

describe('the insights collection', () => {
  it('is empty until the first article is actually written', () => {
    // Module 2 builds the architecture; publishing is a content decision.
    expect(insights).toHaveLength(0);
  });

  it('has unique slugs', () => {
    const slugs = insights.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('references only pillars that exist', () => {
    for (const article of insights) {
      expect(pillarSlugs).toContain(article.pillar);
      expect(() => getPillar(article.pillar)).not.toThrow();
    }
  });

  it('curates related articles that exist and are published', () => {
    for (const article of insights) {
      for (const slug of article.relatedSlugs ?? []) {
        expect(getPublishedInsight(slug)).toBeDefined();
      }
    }
  });

  it('dates every article as an ISO calendar date', () => {
    for (const article of insights) {
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (article.updatedAt) {
        expect(article.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('publishes nothing, so /insights renders its empty state', () => {
    expect(publishedInsights).toHaveLength(0);
  });
});

describe('the publishing gate', () => {
  it('treats an article without the flag as published', () => {
    expect(isPublished(fixture())).toBe(true);
  });

  it('withholds a draft', () => {
    expect(isPublished(fixture({ draft: true }))).toBe(false);
  });
});

describe('getPublishedInsight', () => {
  it('does not resolve a slug that was never written', () => {
    // The route turns this into notFound() rather than a rendered page.
    expect(getPublishedInsight('an-article-nobody-wrote')).toBeUndefined();
    expect(getPublishedInsight('')).toBeUndefined();
  });
});

describe('resolveRelated', () => {
  const article = fixture({
    slug: 'first',
    relatedSlugs: ['second', 'a-draft', 'never-written', 'first'],
  });
  const pool = [
    article,
    fixture({ slug: 'second', title: 'Second' }),
    fixture({ slug: 'a-draft', draft: true }),
  ].filter(isPublished);

  it('keeps the editor’s order and drops what cannot be linked', () => {
    // A draft, a missing article and a self-reference are all dead links.
    expect(resolveRelated(article, pool).map((a) => a.slug)).toEqual(['second']);
  });

  it('returns nothing when an article curates nothing', () => {
    expect(resolveRelated(fixture(), pool)).toEqual([]);
  });
});

describe('insightsForPillar', () => {
  it('selects by the article’s primary pillar', () => {
    const pool = [
      fixture({ slug: 'a', pillar: 'software-development' }),
      fixture({ slug: 'b', pillar: 'growth-systems' }),
    ];
    expect(insightsForPillar('growth-systems', pool).map((a) => a.slug)).toEqual(
      ['b'],
    );
    expect(insightsForPillar('business-automation', pool)).toEqual([]);
  });
});

describe('buildInsightMetadata', () => {
  const article = fixture({
    slug: 'custom-software-or-saas',
    title: 'A Fixture Title',
    description: 'A fixture description.',
    updatedAt: '2026-02-01',
  });
  const meta = buildInsightMetadata(article);

  it('takes title and description from the article, not the homepage', () => {
    expect(meta.title).toBe('A Fixture Title');
    expect(meta.description).toBe('A fixture description.');
    expect(meta.description).not.toBe(siteConfig.description);
  });

  it('canonicalises to the article’s own path', () => {
    expect(meta.alternates?.canonical).toBe('/insights/custom-software-or-saas');
    expect(insightPath(article.slug)).toBe('/insights/custom-software-or-saas');
  });

  it('gives the article its own Open Graph title, description and URL', () => {
    expect(meta.openGraph?.title).toBe(`A Fixture Title — ${siteConfig.name}`);
    expect(meta.openGraph?.description).toBe('A fixture description.');
    expect(meta.openGraph?.url).toBe(
      `${siteConfig.url}/insights/custom-software-or-saas`,
    );
    // The homepage's values must never leak onto an article (technical audit
    // §OG inheritance).
    expect(meta.openGraph?.url).not.toBe(siteConfig.url);
    expect(meta.openGraph?.title).not.toBe(
      `${siteConfig.name} — ${siteConfig.tagline}`,
    );
  });

  it('always carries an OG image, falling back to the site one', () => {
    expect(meta.openGraph?.images).toEqual(['/opengraph-image']);
    const withOwn = buildInsightMetadata(
      fixture({ ogImage: '/insights/example.png' }),
    );
    expect(withOwn.openGraph?.images).toEqual(['/insights/example.png']);
  });

  it('publishes article dates', () => {
    const og = meta.openGraph as { publishedTime?: string; modifiedTime?: string };
    expect(og.publishedTime).toBe('2026-01-15');
    expect(og.modifiedTime).toBe('2026-02-01');
  });

  it('leaves a published article indexable', () => {
    expect(meta.robots).toBeUndefined();
  });

  it('keeps a draft out of the index if it is ever rendered', () => {
    const draft = buildInsightMetadata(fixture({ draft: true }));
    expect(draft.robots).toEqual({ index: false, follow: false });
  });
});

describe('formatInsightDate', () => {
  it('formats in the reader’s language', () => {
    expect(formatInsightDate('2026-01-15', 'en')).toBe('January 15, 2026');
    expect(formatInsightDate('2026-01-15', 'de')).toBe('15. Januar 2026');
  });

  it('does not shift the calendar date across time zones', () => {
    // Parsed and formatted in UTC: a date must not read as the day before.
    expect(formatInsightDate('2026-01-01', 'en')).toContain('1, 2026');
  });
});
