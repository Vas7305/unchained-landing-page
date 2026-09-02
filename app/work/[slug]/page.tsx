import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import { detailedProjects, getProject } from '@/lib/projects';

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

  return {
    title: project.title,
    description: project.summary ?? project.description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.title} — Unchained Business`,
      description: project.summary ?? project.description,
      type: 'article',
      // Defining `openGraph` here opts this route out of the root
      // opengraph-image file convention, so it needs its own image — the
      // project's real screenshot is more useful for a share preview than
      // the generic site image anyway.
      ...((project.heroImage ?? project.thumbnail)
        ? { images: [project.heroImage ?? project.thumbnail!] }
        : {}),
    },
    // Only projects with `detailed: true` have enough published content to
    // warrant a public SEO landing page (lib/projects.ts). Others still
    // render normally for direct access, but are kept out of the index.
    ...(project.detailed ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
