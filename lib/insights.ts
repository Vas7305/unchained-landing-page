/**
 * Insights — the site's editorial layer.
 *
 * Same pattern as lib/projects.ts and lib/pillar-content.ts: a typed array is
 * the entire content system. Adding an article object below publishes it to
 * /insights and gives it a page at /insights/<slug>. No CMS, no MDX, no build
 * step beyond the normal deploy.
 *
 * PUBLISHING GATE: an entry marked `draft: true` is not published — it stays
 * out of the index, out of the sitemap, and out of the route's static params,
 * so /insights/<slug> 404s until the flag comes off. This is deliberate: the
 * /work/[slug] route treats every array entry as a live URL, and repeating
 * that here would turn an unfinished draft into an indexable page the moment
 * someone started writing it.
 *
 * CONTENT RULE: the collection is intentionally empty. Which article gets
 * written first is a content decision, not an infrastructure one — nothing is
 * added here to demonstrate that the route works.
 */

import type { Metadata } from 'next';
import { buildPageMetadata, SITE_OG_IMAGE } from '@/lib/metadata';
import type { PillarSlug } from '@/lib/site';

/** One `<h2>` section of an article body. */
export type InsightSection = {
  heading: string;
  /** One string per paragraph. */
  body: string[];
  /** Optional bullet list, rendered after the paragraphs. */
  points?: string[];
};

export type InsightArticle = {
  /** URL segment. Unique across the collection. */
  slug: string;
  title: string;
  /** Meta description, and the excerpt shown on the index card. */
  description: string;
  /** Opening paragraph, shown under the title. */
  lede: string;
  /** ISO calendar date, e.g. '2026-09-14'. */
  publishedAt: string;
  /** ISO calendar date. Only set when an article is materially revised. */
  updatedAt?: string;
  /**
   * The article's single primary pillar. Reuses the `pillars` array in
   * lib/site.ts — an article may mention another pillar in its body, but it
   * has one primary intent, and there is no second taxonomy.
   */
  pillar: PillarSlug;
  sections: InsightSection[];
  /**
   * Slugs of other articles worth reading next. Editorially chosen — never
   * generated from keyword similarity.
   */
  relatedSlugs?: string[];
  /** Slug of a project in lib/projects.ts whose evidence the article rests on. */
  caseStudySlug?: string;
  /**
   * Overrides the site-wide OG image. Optional by design: an article with no
   * image of its own still gets a valid one (see `buildInsightMetadata`).
   */
  ogImage?: string;
  /** Written but not published. No page, no index entry, no sitemap entry. */
  draft?: boolean;
};

export const insights: InsightArticle[] = [];

/** Newest first; the ISO date format sorts lexicographically. */
function byNewestFirst(a: InsightArticle, b: InsightArticle): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function isPublished(article: InsightArticle): boolean {
  return article.draft !== true;
}

/** The only list any public surface should render. */
export const publishedInsights: InsightArticle[] = insights
  .filter(isPublished)
  .sort(byNewestFirst);

export function insightPath(slug: string): string {
  return `/insights/${slug}`;
}

export function getPublishedInsight(slug: string): InsightArticle | undefined {
  return publishedInsights.find((a) => a.slug === slug);
}

/**
 * The curated related articles that actually exist and are published. A slug
 * that names a draft, or an article that was never written, is dropped rather
 * than rendered as a dead link.
 */
export function resolveRelated(
  article: InsightArticle,
  pool: InsightArticle[] = publishedInsights,
): InsightArticle[] {
  return (article.relatedSlugs ?? [])
    .map((slug) => pool.find((a) => a.slug === slug))
    .filter(
      (a): a is InsightArticle =>
        a !== undefined && a.slug !== article.slug,
    );
}

/** Articles under one pillar — for the pillar pages' future reading lists. */
export function insightsForPillar(
  pillar: PillarSlug,
  pool: InsightArticle[] = publishedInsights,
): InsightArticle[] {
  return pool.filter((a) => a.pillar === pillar);
}

/**
 * Article metadata, derived entirely from the article's own data.
 *
 * Every value the root layout would otherwise supply — title, description,
 * canonical, and the whole Open Graph block — is overridden here through the
 * site's one metadata builder, so no article ever ships with the homepage's
 * share preview.
 */
export function buildInsightMetadata(article: InsightArticle): Metadata {
  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: insightPath(article.slug),
    type: 'article',
    // An article with no image of its own still gets a valid one: declaring
    // `openGraph` opts a route out of the root opengraph-image file
    // convention, so the site image has to be named explicitly.
    image: article.ogImage ?? SITE_OG_IMAGE,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    // Belt and braces: the route only generates published slugs, but a draft
    // that somehow reached a renderer must not be indexable.
    ...(article.draft ? { robots: { index: false, follow: false } } : {}),
  });
}

/**
 * Publication dates are rendered in the reader's language. Parsed and
 * formatted in UTC so a calendar date never shifts by a day for a visitor
 * west of Greenwich.
 */
export function formatInsightDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
