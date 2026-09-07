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
import { fallbackProjects, findProject } from './projects';
import { getPillar, pillars, siteConfig } from './site';

/**
 * Two kinds of check live here. The collection-wide invariants (unique slugs,
 * real pillar references, curated links that resolve) run over the published
 * content itself. The behavioural checks — the publishing gate, slug
 * resolution, the metadata builder — run against fixtures declared below,
 * which are test data rather than content: nothing in `fixture()` is
 * rendered, indexed or published.
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
  it('holds the articles that have actually been written', () => {
    // Publishing is a content decision; the architecture just carries it.
    expect(insights.length).toBeGreaterThan(0);
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

  it('gives /insights something to render, newest first', () => {
    // InsightsIndex maps over exactly this list, so a published article
    // reaches the index without anything being registered by hand.
    expect(publishedInsights.length).toBe(insights.filter(isPublished).length);
    const dates = publishedInsights.map((a) => a.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  // Checked against `fallbackProjects` rather than the database: a slug named
  // here is written by an author editing this repository, and the question this
  // asks is whether they typed one the repository knows. A project unpublished
  // in the panel is a different matter, and the article route handles it by
  // dropping the link.
  it('names only case studies that exist', () => {
    for (const article of insights) {
      if (article.caseStudySlug) {
        expect(findProject(fallbackProjects, article.caseStudySlug)).toBeDefined();
      }
    }
  });
});

/**
 * The first published article. These assert the content, not the plumbing:
 * that the piece is complete enough to publish and points where it claims to.
 */
describe('Custom Software or SaaS? A Framework for Deciding', () => {
  const article = getPublishedInsight('custom-software-or-saas')!;

  it('resolves from its slug', () => {
    expect(article).toBeDefined();
    expect(article.slug).toBe('custom-software-or-saas');
    expect(insightPath(article.slug)).toBe('/insights/custom-software-or-saas');
  });

  it('is published, not a draft', () => {
    expect(article.draft).toBeUndefined();
    expect(isPublished(article)).toBe(true);
  });

  it('sits under the software development pillar', () => {
    expect(article.pillar).toBe('software-development');
    expect(getPillar(article.pillar).title).toBe('Software Development');
    expect(insightsForPillar('software-development')).toContain(article);
  });

  it('populates every field the page and the schema read', () => {
    expect(article.title).toBe('Custom Software or SaaS? A Framework for Deciding');
    expect(article.description.length).toBeGreaterThan(80);
    expect(article.lede.length).toBeGreaterThan(80);
    expect(article.publishedAt).toBe('2026-09-02');
    // Never revised, so no modification date is claimed.
    expect(article.updatedAt).toBeUndefined();
  });

  it('carries an argument rather than a stub', () => {
    expect(article.sections.length).toBeGreaterThanOrEqual(7);
    for (const section of article.sections) {
      expect(section.heading.length).toBeGreaterThan(10);
      expect(section.body.length).toBeGreaterThan(0);
      for (const paragraph of section.body) {
        expect(paragraph.split(' ').length).toBeGreaterThan(20);
      }
    }

    const words = article.sections
      .flatMap((s) => [...s.body, ...(s.points ?? [])])
      .join(' ')
      .split(/\s+/).length;
    expect(words).toBeGreaterThan(1800);
    expect(words).toBeLessThan(2800);
  });

  it('rests on a case study that exists and is published', () => {
    expect(article.caseStudySlug).toBe('tancerca');
    expect(findProject(fallbackProjects, 'tancerca')?.detailed).toBe(true);
  });

  it('curates no further reading while it is the only article', () => {
    // A related list is editorial. There is nothing honest to put in it yet.
    expect(resolveRelated(article)).toEqual([]);
  });

  it('takes the site OG image rather than inventing an asset', () => {
    expect(article.ogImage).toBeUndefined();
    expect(buildInsightMetadata(article).openGraph?.images).toEqual([
      '/opengraph-image',
    ]);
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
  it('gives the pillar page its reading list', () => {
    // What PillarPage renders: the relationship is the article's `pillar`
    // field, not a list maintained on the page.
    expect(insightsForPillar('software-development').map((a) => a.slug)).toContain(
      'custom-software-or-saas',
    );
    expect(insightsForPillar('growth-systems')).toEqual([]);
  });

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
