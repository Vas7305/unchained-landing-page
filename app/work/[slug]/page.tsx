import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import JsonLd from '@/components/JsonLd';
import { detailedOf, findProject } from '@/lib/projects';
import { loadProjects } from '@/lib/portfolio';
import { SITE_OG_IMAGE } from '@/lib/metadata';
import { buildCmsMetadata } from '@/lib/cms/seo';
import { breadcrumbSchema } from '@/lib/structured-data';

type Params = { slug: string };

/** Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. See app/page.tsx. */
export const revalidate = 600;

/**
 * The detail pages worth prerendering at build time.
 *
 * `dynamicParams` is deliberately left at its default of true, which is what
 * it has always been here: a project without `detailed` still renders for
 * anyone who has its URL, and now a project PUBLISHED in the panel after this
 * build renders on first request too, instead of 404ing until somebody
 * redeploys. That is the whole point of moving the portfolio into a database.
 */
export async function generateStaticParams(): Promise<Params[]> {
  return detailedOf(await loadProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(await loadProjects(), slug);

  if (!project) return { title: 'Project not found' };

  return buildCmsMetadata(
    {
      title: project.title,
      description: project.summary ?? project.description,
      path: `/work/${project.slug}`,
      type: 'article',
      // The project's real screenshot is a better share preview than the
      // generic site image; a project without one still gets a valid
      // og:image, because declaring `openGraph` opts the route out of the root
      // file convention.
      image: project.heroImage ?? project.thumbnail ?? SITE_OG_IMAGE,
      // Only projects with `detailed: true` have enough published content to
      // warrant a public SEO landing page — the flag the panel sets, which the
      // database refuses without the prose behind it. Others still render
      // normally for direct access, but are kept out of the index.
      ...(project.detailed ? {} : { robots: { index: false, follow: true } }),
    },
    // The editor's overrides, applied over those defaults.
    //
    // ─── Metadata is NOT localized here, and that is deliberate ──────────
    // generateMetadata runs on the server at build/revalidate time, where
    // there is no visitor and therefore no locale — the page is prerendered in
    // the default locale and switches on the client, which cannot change a
    // <title> a crawler already read. So the SEO block is the default locale's,
    // matching the language of the prerendered HTML it describes. The
    // per-locale seo_title and seo_description the CMS stores are there for
    // the day the site adopts per-locale routes; until then they are carried
    // and unused rather than applied to the wrong document.
    project.seo,
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = findProject(await loadProjects(), slug);

  if (!project) notFound();

  return (
    <>
      {/* Home > Our Work > project, matching the trail the page already shows
          as its "All work" link. Emitted only for the projects that are
          indexable — a noindex page has no hierarchy worth publishing. */}
      {project.detailed && (
        <JsonLd
          data={breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Our Work', path: '/work' },
            { name: project.title, path: `/work/${project.slug}` },
          ])}
        />
      )}
      <ProjectDetail project={project} />
    </>
  );
}
