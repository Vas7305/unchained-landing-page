/**
 * CMS-managed SEO metadata, and the fallback chain behind it.
 *
 * ─── The rule this file implements ────────────────────────────────────────
 * Every SEO field is an OVERRIDE. The site already derives good metadata from
 * the content itself — app/work/[slug]/page.tsx has always passed the title
 * and the summary to buildPageMetadata() — and that derivation stays the
 * default. What the CMS adds is the ability to write something better for the
 * cases where the first sentence of a page is not the sentence you want in a
 * search result.
 *
 * The chain, as the brief specifies it:
 *
 *   SEO title        → content title
 *   SEO description  → excerpt / short description
 *   OG title         → SEO title → content title
 *   OG description   → SEO description → content description
 *   OG image         → the content's own image → the site image
 *
 * ─── "Do not generate meaningless duplicate metadata" ─────────────────────
 * The chain above deliberately produces the SAME string in several slots when
 * nothing is overridden — og:title equal to the title is correct and is what
 * every well-formed page does. What would be meaningless is padding: appending
 * the company name twice, or synthesising a description by truncating the body.
 * Neither happens here. A field with no content and no override is ABSENT, and
 * an absent og:description is better than one built out of the first 160
 * characters of a paragraph.
 */

import type { Metadata } from 'next';
import { SITE_OG_IMAGE, buildPageMetadata } from '@/lib/metadata';
import { text, externalUrl, mediaRef } from './sanitize';

/** The overrides an editor may set, all optional. */
export type SeoFields = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  /** Set only when the canonical is NOT this page's own URL. */
  canonicalUrl?: string;
};

/**
 * Read the SEO block out of an untrusted row.
 *
 * Lengths match the database's CHECK constraints, so a value that was stored
 * cannot be truncated here — the two agree, and this is the wall for a row
 * that predates the constraint.
 *
 * Returns undefined when nothing was set, so the property can be left off the
 * content object entirely rather than carried as an empty record.
 */
export function readSeo(row: Record<string, unknown>): SeoFields | undefined {
  const seo: SeoFields = {
    title: text(row.seo_title, 70) ?? undefined,
    description: text(row.seo_description, 160) ?? undefined,
    ogTitle: text(row.og_title, 90) ?? undefined,
    ogDescription: text(row.og_description, 200) ?? undefined,
    ogImage: mediaRef(row.og_image),
    canonicalUrl: externalUrl(row.canonical_url),
  };

  // Drop the undefined keys so `localize()` does not overwrite a parent value
  // with "this locale did not set it".
  for (const key of Object.keys(seo) as (keyof SeoFields)[]) {
    if (seo[key] === undefined) delete seo[key];
  }

  return Object.keys(seo).length > 0 ? seo : undefined;
}

/** What a content item supplies when it has no override for a field. */
export type SeoDefaults = {
  /** The content's own title. */
  title: string;
  /** The content's own excerpt or short description. */
  description: string;
  /** Root-relative path — the canonical, unless one is overridden. */
  path: string;
  /** The content's own image, if it has one. */
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  /** Set for a page that must not be indexed — a preview, or a thin page. */
  robots?: Metadata['robots'];
};

/**
 * The page's metadata, from its overrides and its content.
 *
 * Built through the site's one metadata builder rather than beside it, so a
 * CMS page and a hand-written page produce the same SHAPE of metadata and
 * there is still exactly one place that knows how to write an Open Graph
 * block.
 *
 * ─── Why the canonical override is applied afterwards ─────────────────────
 * buildPageMetadata() takes a root-relative path and resolves it against the
 * canonical host, which is right for every page the site owns. A canonical
 * override is by definition a URL somewhere else — that is the only reason to
 * set one — so it replaces the resolved value rather than being passed through
 * a resolver that would treat it as a path.
 */
export function buildCmsMetadata(
  defaults: SeoDefaults,
  seo: SeoFields | undefined,
): Metadata {
  const title = seo?.title ?? defaults.title;
  const description = seo?.description ?? defaults.description;

  const metadata = buildPageMetadata({
    title,
    description,
    path: defaults.path,
    // og:title falls back through the SEO title to the content title. Passed
    // explicitly because buildPageMetadata's own default appends the company
    // name, and an editor who wrote an OG title meant that exact string.
    socialTitle: seo?.ogTitle,
    type: defaults.type ?? 'website',
    image: seo?.ogImage ?? defaults.image ?? SITE_OG_IMAGE,
    publishedTime: defaults.publishedTime,
    modifiedTime: defaults.modifiedTime,
    robots: defaults.robots,
  });

  // og:description is its own field: a social card has more room than a search
  // result, and an editor may want the longer sentence there.
  if (seo?.ogDescription && metadata.openGraph) {
    metadata.openGraph.description = seo.ogDescription;
  }
  if (seo?.ogDescription && metadata.twitter) {
    metadata.twitter.description = seo.ogDescription;
  }

  if (seo?.canonicalUrl) {
    metadata.alternates = { ...metadata.alternates, canonical: seo.canonicalUrl };
  }

  return metadata;
}
