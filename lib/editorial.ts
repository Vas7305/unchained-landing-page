/**
 * The public website's third question: "what has been published?"
 *
 * ─── The same shape as lib/portfolio.ts, deliberately ─────────────────────
 * One RPC over PostgREST, read on the server, with the typed array in
 * lib/insights.ts as the fallback for a build that has no database behind it.
 * That pattern was settled for the portfolio and is not being redesigned for
 * the second content type; a reader who understands one understands both, and
 * the arguments in lib/portfolio.ts's header — why fetch and not supabase-js,
 * why server-only, why `next.revalidate` instead of `cache: 'no-store'` —
 * apply here word for word.
 *
 * ─── What decides which articles are public ───────────────────────────────
 * `WHERE a.published AND a.archived_at IS NULL`, inside list_public_insights().
 * Not this file. A line here of the form `if (article.draft) …` would be a
 * second source of truth about publication, and the day somebody unpublishes an
 * article in the panel it would be the line that kept it on the site.
 *
 * The fallback list is the one exception, and it carries its own `draft` flag
 * for the same job — because there is no database in that case to hold the
 * rule.
 */

import { rpcEndpoint } from '@/lib/commercial/config';
import {
  isPublished,
  publishedInsights,
  publishedOf,
  type InsightArticle,
  type InsightCopy,
  type InsightSection,
} from '@/lib/insights';
import { pillars, type PillarSlug } from '@/lib/site';
import {
  bool,
  isoDate,
  labels,
  mediaRef,
  record,
  slug as readSlug,
  text,
} from '@/lib/cms/sanitize';
import { readTranslations } from '@/lib/cms/localized';
import { readSeo } from '@/lib/cms/seo';

/**
 * How long a prerendered page may go on showing the articles it read earlier.
 *
 * Matches PORTFOLIO_REVALIDATE_SECONDS, and for the same reason: the sitemap
 * lists both content types, so two different intervals would let it disagree
 * with one of the pages it points at for as long as the difference between
 * them.
 *
 * As with the portfolio, this constant is documentation and a single place to
 * change deliberately — Next requires the value it reads to be a statically
 * analysable literal, so each route writes `export const revalidate = 600` and
 * will not follow an import to find it. The routes to keep in step are:
 *
 *   app/insights/page.tsx   app/insights/[slug]/page.tsx   app/sitemap.ts
 *
 * Publishing no longer waits for it in the normal case: the panel asks the site
 * to revalidate on publish (see app/api/revalidate/route.ts), and this is the
 * floor underneath that — what happens if the webhook is missed.
 */
export const EDITORIAL_REVALIDATE_SECONDS = 600;

const insightsEndpoint = rpcEndpoint('list_public_insights');

const REQUEST_TIMEOUT_MS = 8000;

const PILLAR_SLUGS: readonly string[] = pillars.map((p) => p.slug);

/** A pillar the site has a page for, or undefined. */
function pillar(value: unknown): PillarSlug | undefined {
  return typeof value === 'string' && PILLAR_SLUGS.includes(value)
    ? (value as PillarSlug)
    : undefined;
}

/**
 * The article body, or undefined.
 *
 * The database validates this shape already —
 * unchained_insight_sections_valid() refuses anything else — so this is the
 * second wall, and it is not redundant: the JSON arrives over a network as
 * `unknown`, and a body that failed to parse must produce an article with no
 * sections rather than a render that throws halfway down the page.
 *
 * A section missing its heading or its paragraphs is DROPPED rather than
 * repaired. Inventing a heading would put a line on the website that nobody
 * wrote, which is the rule this whole content system is held to.
 */
function sections(value: unknown): InsightSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const clean = value.flatMap((entry): InsightSection[] => {
    const row = record(entry);
    if (!row) return [];

    const heading = text(row.heading, 200);
    if (!heading) return [];

    // Paragraphs keep their line breaks: `collapse` false. They are prose, and
    // an author may have written a deliberate break inside one.
    const body = Array.isArray(row.body)
      ? row.body
          .map((p) => text(p, 4000, false))
          .filter((p): p is string => p !== null)
      : [];
    if (body.length === 0) return [];

    const points = labels(row.points, 1000);

    return [{ heading, body, ...(points ? { points } : {}) }];
  });

  return clean.length > 0 ? clean : undefined;
}

/** One locale's translation of an article. */
function readInsightCopy(row: Record<string, unknown>): Partial<InsightCopy> {
  const copy: Partial<InsightCopy> = {
    title: text(row.title, 160) ?? undefined,
    description: text(row.description, 300) ?? undefined,
    lede: text(row.lede, 1000, false) ?? undefined,
    sections: sections(row.sections),
    coverImageAlt: text(row.cover_image_alt, 300) ?? undefined,
    seo: readSeo(row),
  };

  for (const key of Object.keys(copy) as (keyof InsightCopy)[]) {
    if (copy[key] === undefined) delete copy[key];
  }

  return copy;
}

/** Every column the RPC returns. Every one of them is untrusted. */
interface InsightRow {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  lede?: unknown;
  pillar?: unknown;
  tags?: unknown;
  author?: unknown;
  sections?: unknown;
  related_slugs?: unknown;
  case_study_slug?: unknown;
  cover_image?: unknown;
  cover_image_alt?: unknown;
  og_image?: unknown;
  featured?: unknown;
  published_on?: unknown;
  revised_on?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  og_title?: unknown;
  og_description?: unknown;
  canonical_url?: unknown;
  translations?: unknown;
}

/**
 * One row as the site's own model, or null when the row cannot be rendered.
 *
 * ─── What is required, and why each one ───────────────────────────────────
 * An article needs a slug (it has no URL without one), a title and a
 * description (the index card is otherwise blank), a pillar (the breadcrumb
 * and the schema both read it), a date (the page prints it and the index sorts
 * on it) and at least one section (the page is otherwise a headline over
 * nothing).
 *
 * The database refuses to PUBLISH an article missing any of those — see
 * unchained_insights_published_is_complete — so a row reaching here without
 * one has been written around that constraint, and the honest response is to
 * drop it rather than to render a broken page.
 *
 * `lede` is the one required field of the five that the database also requires
 * but which degrades here instead: an article with paragraphs and no opening
 * line is still readable.
 *
 * ─── `draft` relaxes exactly what the database relaxes ────────────────────
 * unchained_insights_published_is_complete requires a date and a body TO
 * PUBLISH, not to exist. So a draft being previewed legitimately has neither —
 * that is what an article looks like on the morning somebody starts writing
 * it — and refusing to render one would make preview useless for the case it
 * is most needed in.
 *
 * The two relaxations are narrow and neither invents content: a missing date
 * falls back to today, which is what the article would be dated if it were
 * published now, and a missing body renders as no sections rather than as
 * placeholder prose. Everything else is required in both modes, because a
 * draft with no title or no pillar cannot be laid out at all.
 *
 * `draft` is reachable only from lib/preview.ts, which requires a valid token.
 * The public loader below never passes it.
 */
export function toInsight(
  row: InsightRow | null | undefined,
  { draft = false }: { draft?: boolean } = {},
): InsightArticle | null {
  if (!row || typeof row !== 'object') return null;

  const slug = readSlug(row.slug);
  const title = text(row.title, 160);
  const description = text(row.description, 300);
  const primaryPillar = pillar(row.pillar);
  const publishedAt = isoDate(row.published_on);
  const body = sections(row.sections);

  if (!slug || !title || !description || !primaryPillar) return null;
  if (!draft && (!publishedAt || !body)) return null;

  const coverImage = mediaRef(row.cover_image);

  const article: InsightArticle = {
    slug,
    title,
    description,
    // The database allows a published article to have a lede and the type
    // requires one; an empty string would render as a blank paragraph, so the
    // description stands in. It is the same sentence in a different place, not
    // invented copy.
    lede: text(row.lede, 1000, false) ?? description,
    // `new Date().toISOString()` and not a constant: an undated draft is
    // previewed as though it were being published now, which is the only date
    // that is true of it.
    publishedAt: publishedAt ?? new Date().toISOString().slice(0, 10),
    pillar: primaryPillar,
    sections: body ?? [],
  };

  const revised = isoDate(row.revised_on);
  if (revised) article.updatedAt = revised;

  // list_public_insights() has already dropped the slugs that name drafts, so
  // what arrives is a list the site can link to. Re-read here only for shape.
  const related = Array.isArray(row.related_slugs)
    ? row.related_slugs
        .map((value) => readSlug(value))
        .filter((value): value is string => value !== undefined)
    : [];
  if (related.length > 0) article.relatedSlugs = related;

  const caseStudy = readSlug(row.case_study_slug);
  if (caseStudy) article.caseStudySlug = caseStudy;

  if (coverImage) {
    article.coverImage = coverImage;
    const alt = text(row.cover_image_alt, 300);
    if (alt) article.coverImageAlt = alt;
  }

  const ogImage = mediaRef(row.og_image);
  if (ogImage) article.ogImage = ogImage;

  const tags = labels(row.tags, 60);
  if (tags) article.tags = tags;

  const author = text(row.author, 120);
  if (author) article.author = author;

  if (bool(row.featured)) article.featured = true;

  const seo = readSeo(row as Record<string, unknown>);
  if (seo) article.seo = seo;

  const translations = readTranslations<InsightCopy>(
    row.translations,
    readInsightCopy,
  );
  if (translations) article.translations = translations;

  return article;
}

/**
 * The published articles, newest first.
 *
 * ─── When this falls back, and when it does not ───────────────────────────
 * Identical to loadProjects(), including the case that is deliberately NOT a
 * fallback: a successful call returning zero articles is an ANSWER. Falling
 * back there would mean the panel can archive the last article and the site
 * would resurrect it on the next build, with nothing in the panel to explain
 * why.
 *
 * It never throws. Every caller is a page being prerendered, and an exception
 * would fail the build over an editorial list that has a perfectly good
 * offline answer in the same repository.
 */
export async function loadInsights(): Promise<InsightArticle[]> {
  if (!insightsEndpoint) return publishedInsights;

  let rows: unknown;

  try {
    const response = await fetch(insightsEndpoint.url, {
      method: 'POST',
      headers: {
        apikey: insightsEndpoint.anonKey,
        Authorization: `Bearer ${insightsEndpoint.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // Not `cache: 'no-store'`. See lib/portfolio.ts: an explicit no-store
      // fetch opts the whole route out of static rendering, which for a
      // landing page is the opposite of what moving content into a database
      // was for.
      next: { revalidate: EDITORIAL_REVALIDATE_SECONDS },
    });

    if (!response.ok) return publishedInsights;
    rows = await response.json();
  } catch {
    return publishedInsights;
  }

  if (!Array.isArray(rows)) return publishedInsights;

  const articles = rows
    .map((row) => toInsight(row as InsightRow))
    .filter((article): article is InsightArticle => article !== null);

  // Zero rows from a successful call is an empty editorial section and is
  // respected. Zero USABLE rows out of rows that did arrive is a database
  // saying something this site cannot read, which is a failure like any other.
  if (articles.length === 0 && rows.length > 0) return publishedInsights;

  return publishedOf(dedupe(articles));
}

/**
 * At most one article per slug.
 *
 * Enforced by a UNIQUE column, so this cannot fire against the real table. It
 * exists because two rows sharing a slug would give /insights/<slug> two
 * candidate pages, and deciding it here means the answer is the same whatever
 * the site is reading. First wins, matching the incoming order.
 */
function dedupe(articles: InsightArticle[]): InsightArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.slug)) return false;
    seen.add(article.slug);
    // A row that arrives flagged as a draft has escaped the function's own
    // filter. Dropping it here costs nothing and means the publication rule
    // holds even against a database this build does not recognise.
    return isPublished(article);
  });
}
