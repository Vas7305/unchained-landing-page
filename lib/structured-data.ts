/**
 * JSON-LD for the site.
 *
 * Small and deliberately un-generic: three entity builders plus a serializer,
 * all pure functions over data that already exists (`siteConfig`, `pillars`,
 * `InsightArticle`). No schema framework, no dependency — the objects are
 * plain and the types are local.
 *
 * TRUTHFULNESS RULE, same as the content files: every property here must
 * correspond to something the site actually publishes. No invented founding
 * dates, employee counts, ratings, awards, social profiles or people. The
 * point of this file is entity clarity, not search-result decoration.
 */

import { siteConfig } from '@/lib/site';
import { absoluteUrl, SITE_OG_IMAGE } from '@/lib/metadata';
import { insightPath, type InsightArticle } from '@/lib/insights';

/** A JSON-LD node. Loose by design: schema.org is open-ended. */
export type JsonLdNode = {
  '@context'?: string;
  '@type': string;
  [key: string]: unknown;
};

const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * The single identity every other entity points at. One `@id`, site-wide, so
 * the Organization emitted by the root layout and the `publisher` of an
 * article are the same node rather than two organizations that share a name.
 */
export const ORGANIZATION_ID = `${siteConfig.url}/#organization`;

/** The company logo the navbar and footer actually render. */
const LOGO_PATH = '/unchained-business-logo.png';

/**
 * Unchained Business, as an entity.
 *
 * The name is written in full: "Unchained" alone is ambiguous — several
 * unrelated companies use it — and the whole purpose of this node is to tie
 * the name to this domain. `sameAs` is deliberately absent: the footer's
 * social links are placeholders (`siteConfig.social` is `'#'`), and pointing
 * at profiles that do not exist would be worse than pointing at none.
 */
export function organizationSchema(): JsonLdNode {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: siteConfig.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl(LOGO_PATH),
    description: siteConfig.description,
  };
}

/** A reference to the Organization node above, resolved by `@id`. */
function organizationRef(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: siteConfig.name,
    url: absoluteUrl('/'),
  };
}

export type BreadcrumbItem = {
  name: string;
  /** Root-relative path, e.g. `/insights`. */
  path: string;
};

/**
 * A trail, in order, starting at the home page. Positions are 1-based and
 * every entry carries its absolute URL, including the current page.
 */
export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * An Insight article.
 *
 * `Article` rather than `BlogPosting`: the collection is a professional
 * insights library reached from /insights, not a dated blog feed, and there is
 * no `Blog` container entity for a `BlogPosting` to belong to. Google treats
 * the two identically for rich results, so the more general and more accurate
 * type wins.
 *
 * `author` is the organization. Module 2 has no author model on purpose, and
 * inventing a person or an "editorial team" to satisfy a recommended property
 * would be exactly the kind of fiction the content rules forbid — Schema.org
 * allows an Organization as author, and that is who actually writes these.
 */
export function articleSchema(article: InsightArticle): JsonLdNode {
  const path = insightPath(article.slug);
  const url = absoluteUrl(path);

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.description,
    // Same fallback the page metadata uses, so the share preview and the
    // structured data never disagree about the article's image.
    image: absoluteUrl(article.ogImage ?? SITE_OG_IMAGE),
    datePublished: article.publishedAt,
    // An article that has never been revised was last modified when it was
    // published; `updatedAt` is only set on a material revision.
    dateModified: article.updatedAt ?? article.publishedAt,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: organizationRef(),
    publisher: organizationRef(),
    inLanguage: 'en',
  };
}

export type FaqEntry = { question: string; answer: string };

/**
 * The homepage's question-and-answer section, as published.
 *
 * Only ever called with the questions the page actually renders (see
 * `lib/faq.ts`). Nothing is written for the schema's benefit.
 */
export function faqPageSchema(entries: FaqEntry[]): JsonLdNode {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/**
 * JSON-LD as the text of a `<script>` element.
 *
 * `<` is escaped so a `</script>` sequence inside any string can never close
 * the element early; `>` and `&` go with it so the payload cannot open an
 * element or an entity either. The escapes are valid JSON, so parsers read the
 * original characters back unchanged.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
