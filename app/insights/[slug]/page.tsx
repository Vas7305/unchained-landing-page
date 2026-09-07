import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InsightArticleView from '@/components/InsightArticleView';
import JsonLd from '@/components/JsonLd';
import {
  buildInsightMetadata,
  getPublishedInsight,
  insightPath,
  publishedInsights,
} from '@/lib/insights';
import { articleSchema, breadcrumbSchema } from '@/lib/structured-data';
import { loadProjects } from '@/lib/portfolio';
import { findProject } from '@/lib/projects';

type Params = { slug: string };

/**
 * Only published articles get a URL. With `dynamicParams` off, every other
 * slug — a draft, a typo, a stale external link — is a framework 404 rather
 * than a rendered page, so an unpublished article can never become an
 * accidentally indexable URL (technical audit §21).
 */
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return publishedInsights.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedInsight(slug);

  if (!article) return { title: 'Article not found' };

  return buildInsightMetadata(article);
}

export default async function InsightPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = getPublishedInsight(slug);

  if (!article) notFound();

  // The case study the article rests on, resolved here because the portfolio
  // lives in the database now and InsightArticleView is a client component.
  // An article naming a project that has since been unpublished simply loses
  // the link, which is the right outcome — the page it pointed at is gone.
  const caseStudy = article.caseStudySlug
    ? findProject(await loadProjects(), article.caseStudySlug)
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
      <InsightArticleView article={article} caseStudy={caseStudy} />
    </>
  );
}
