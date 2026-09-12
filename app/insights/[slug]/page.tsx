import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InsightArticleView from '@/components/InsightArticleView';
import JsonLd from '@/components/JsonLd';
import {
  buildInsightMetadata,
  getPublishedInsight,
  insightPath,
} from '@/lib/insights';
import { loadInsights } from '@/lib/editorial';
import { articleSchema, breadcrumbSchema } from '@/lib/structured-data';
import { loadProjects } from '@/lib/portfolio';
import { findProject } from '@/lib/projects';

type Params = { slug: string };

/** Ten minutes, matching EDITORIAL_REVALIDATE_SECONDS. See lib/editorial.ts. */
export const revalidate = 600;

/**
 * The articles worth prerendering at build time.
 *
 * ─── `dynamicParams` is now left at its default of true ───────────────────
 * It used to be false, with a good reason: "every other slug — a draft, a
 * typo, a stale external link — is a framework 404 rather than a rendered
 * page, so an unpublished article can never become an accidentally indexable
 * URL."
 *
 * That reason was sound while the collection was a typed array, where the set
 * of published articles could only change by deploying. It stops being sound
 * once articles are published from a panel: with it false, an article
 * published on Tuesday would 404 until somebody redeployed the site, which is
 * precisely the dependency on source-code changes the CMS exists to remove.
 * /work/[slug] made the same change for the same reason when the portfolio
 * moved into the database.
 *
 * The property it was protecting is NOT lost, because it was never really
 * `dynamicParams` that held it. A draft is unreachable because
 * list_public_insights() filters on `published` before the site is involved,
 * so an unpublished slug resolves to no article and the page below calls
 * notFound(). The 404 now comes from the data rather than from the route
 * config — which is the stronger of the two, since it holds for a slug that
 * WAS published at build time and has since been unpublished.
 */
export async function generateStaticParams(): Promise<Params[]> {
  return (await loadInsights()).map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedInsight(slug, await loadInsights());

  if (!article) return { title: 'Article not found' };

  return buildInsightMetadata(article);
}

export default async function InsightPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  // ─── Both reads are started here, and awaited further down ──────────────
  // They have no data dependency on each other: loadProjects() takes nothing
  // from loadInsights(), and only WHETHER its answer is needed depends on the
  // article. Awaiting the first before starting the second would therefore
  // serialise two independent round trips for no reason — and every published
  // article does cite a case study, so that is the normal path rather than an
  // edge case.
  //
  // The cost is one wasted request when the article cites no case study, or
  // when the slug resolves to nothing. Both are cheap, and neither can fail
  // the render: loadProjects() is documented never to throw, so the promise
  // left unawaited on the notFound() path below cannot become an unhandled
  // rejection.
  const articlesPromise = loadInsights();
  const projectsPromise = loadProjects();

  // One read, used for the article and for its related list. Resolving the
  // related articles against the same snapshot means a "read next" link can
  // never point at something that was unpublished between two fetches.
  const articles = await articlesPromise;
  const article = getPublishedInsight(slug, articles);

  if (!article) notFound();

  // The case study the article rests on, resolved here because the portfolio
  // lives in the database now and InsightArticleView is a client component.
  // An article naming a project that has since been unpublished simply loses
  // the link, which is the right outcome — the page it pointed at is gone.
  const caseStudy = article.caseStudySlug
    ? findProject(await projectsPromise, article.caseStudySlug)
    : undefined;

  return (
    <>
      {/* Both entities describe this page and agree with each other: the
          Article's publisher and author resolve by `@id` to the one
          Organization the root layout emits, and the trail is the one the
          page shows above the headline. */}
      <JsonLd data={articleSchema(article)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Insights', path: '/insights' },
          { name: article.title, path: insightPath(article.slug) },
        ])}
      />
      <InsightArticleView
        article={article}
        caseStudy={caseStudy}
        pool={articles}
      />
    </>
  );
}
