import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InsightArticleView from '@/components/InsightArticleView';
import PreviewBanner from '@/components/PreviewBanner';
import { loadPreviewInsight } from '@/lib/preview';
import { loadProjects } from '@/lib/portfolio';
import { findProject } from '@/lib/projects';

/**
 * /preview/insights?token=… — one unpublished article.
 *
 * The same design as /preview/work: token in the query, no slug in the URL,
 * dynamic, noindex. See that file for the reasoning; it is not repeated here
 * because the two must not drift, and one explanation that covers both is
 * easier to keep true than two that agree.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false, nocache: true },
};

export default async function InsightPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;

  const preview = await loadPreviewInsight(token);
  if (!preview) notFound();

  const article = preview.content;

  // The case study, resolved against the PUBLISHED portfolio. A draft article
  // may cite a project that is itself still a draft; that link resolves to
  // nothing here, which is correct — the preview shows what the article will
  // look like when published, and at that point the link would be dead too.
  const caseStudy = article.caseStudySlug
    ? findProject(await loadProjects(), article.caseStudySlug)
    : undefined;

  return (
    <>
      <PreviewBanner state={preview.state} />
      {/*
        `pool` is just this article. Related reading resolves against the pool,
        so a preview shows no "read next" links — which is the honest rendering:
        an unpublished article's curated links point at whatever is published
        when IT is published, and that set is not knowable now.
      */}
      <InsightArticleView
        article={article}
        caseStudy={caseStudy}
        pool={[article]}
      />
    </>
  );
}
