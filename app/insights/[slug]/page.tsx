import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InsightArticleView from '@/components/InsightArticleView';
import {
  buildInsightMetadata,
  getPublishedInsight,
  publishedInsights,
} from '@/lib/insights';

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

  return <InsightArticleView article={article} />;
}
