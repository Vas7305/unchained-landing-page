import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import PreviewBanner from '@/components/PreviewBanner';
import { loadPreviewProject } from '@/lib/preview';

/**
 * /preview/work?token=… — one unpublished project, for whoever holds the link.
 *
 * ─── Why the token is a query parameter and not a path segment ────────────
 * Both would work. A query parameter is chosen because it keeps the route
 * static in shape — there is exactly one preview URL per content type, not a
 * family of them — and because it makes the sitemap question trivially
 * answerable: there is no slug to enumerate, so there is nothing here that
 * could be generated into a list of URLs by accident.
 *
 * The slug is deliberately NOT in the URL either. The token already names the
 * content, so including the slug would add nothing except a readable hint
 * about what the draft is called, in a link that gets forwarded by email.
 *
 * ─── force-dynamic, and why it is right here ──────────────────────────────
 * Everywhere else in this codebase, opting out of static rendering is treated
 * as a mistake to be avoided. Here it is the requirement: the page's content
 * depends on a per-request secret, and a prerendered or shared-cache copy of a
 * draft would be exactly the leak the token exists to prevent. It also means
 * an editor sees the save they made thirty seconds ago rather than a page from
 * the last revalidation.
 */
export const dynamic = 'force-dynamic';

/**
 * Never indexed, never followed.
 *
 * The route is unreachable without a token, absent from the sitemap and
 * disallowed in robots.txt — but a directive in the document is the wall that
 * does not depend on a crawler having read a file first. `follow: false` as
 * well as `index: false`: a draft's outbound links should not be crawled on
 * the strength of a page that is not meant to exist yet.
 *
 * The title is generic on purpose. A share preview of a preview link should
 * not disclose the name of an unannounced project.
 */
export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProjectPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;

  // Every failure is this one: no token, a malformed one, an expired or
  // revoked link, a token for an article rather than a project, or a draft too
  // incomplete to render. They are deliberately indistinguishable — telling
  // the holder of a bad token WHY it failed would confirm which of those it is.
  const preview = await loadPreviewProject(token);
  if (!preview) notFound();

  return (
    <>
      <PreviewBanner state={preview.state} />
      <ProjectDetail project={preview.content} />
    </>
  );
}
