import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import JsonLd from '@/components/JsonLd';
import { detailedProjects, getProject } from '@/lib/projects';
import { buildPageMetadata, SITE_OG_IMAGE } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return detailedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) return { title: 'Project not found' };

  return buildPageMetadata({
    title: project.title,
    description: project.summary ?? project.description,
    path: `/work/${project.slug}`,
    type: 'article',
    // The project's real screenshot is a better share preview than the generic
    // site image; a project without one still gets a valid og:image, because
    // declaring `openGraph` opts the route out of the root file convention.
    image: project.heroImage ?? project.thumbnail ?? SITE_OG_IMAGE,
    // Only projects with `detailed: true` have enough published content to
    // warrant a public SEO landing page (lib/projects.ts). Others still
    // render normally for direct access, but are kept out of the index.
    ...(project.detailed ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = getProject(slug);

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
