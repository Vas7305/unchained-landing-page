import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DemoShell from '@/components/demo/DemoShell';
import JsonLd from '@/components/JsonLd';
import { findProject } from '@/lib/projects';
import { loadProjects } from '@/lib/portfolio';
import { hasDemo } from '@/lib/demo/registry';
import { buildPageMetadata, SITE_OG_IMAGE } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

type Params = { slug: string };

/** Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. See app/page.tsx. */
export const revalidate = 600;

/**
 * The interactive demo for one project.
 *
 * ─── Two conditions, and both must hold ───────────────────────────────────
 * A demo page exists where the database has published the project AND this
 * repository contains a demo for its slug. Neither half can conjure the page
 * on its own: unpublishing a project in the admin panel takes its demo down
 * with it, and a demo added here for a project that was never published stays
 * unreachable. That is the join lib/demo/registry.ts describes, applied at the
 * one place it matters.
 *
 * ─── Indexing follows the project ─────────────────────────────────────────
 * The same rule app/work/[slug]/page.tsx already applies: a project with
 * enough published detail to warrant a public landing page has a demo worth
 * indexing too, and one without it is reachable but kept out of the index. The
 * rule is not restated here as a literal — `project.detailed` is read, exactly
 * as the parent route reads it.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const projects = await loadProjects();
  return projects.flatMap((p) => (hasDemo(p.slug) ? [{ slug: p.slug }] : []));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(await loadProjects(), slug);

  if (!project || !hasDemo(slug)) return { title: 'Demo not found' };

  return buildPageMetadata({
    title: `${project.title} — Interactive Demo`,
    description: `Explore an interactive, simulated demonstration of ${project.title} — ${project.category.toLowerCase()} built by Unchained Business. No account, no setup, no real data.`,
    path: `/work/${project.slug}/demo`,
    image: project.heroImage ?? project.thumbnail ?? SITE_OG_IMAGE,
    ...(project.detailed ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function ProjectDemoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = findProject(await loadProjects(), slug);

  // Both halves of the join, checked here so the shell can assume them. The
  // definition itself is NOT passed down: it holds a function, which cannot
  // cross into a client component. DemoShell reads it from the registry.
  if (!project || !hasDemo(project.slug)) notFound();

  return (
    <>
      {project.detailed && (
        <JsonLd
          data={breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Our Work', path: '/work' },
            { name: project.title, path: `/work/${project.slug}` },
            { name: 'Interactive Demo', path: `/work/${project.slug}/demo` },
          ])}
        />
      )}
      <DemoShell project={project} />
    </>
  );
}
