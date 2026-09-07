import type { Metadata } from 'next';
import WorkPageView from '@/components/WorkPageView';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';
import { loadProjects } from '@/lib/portfolio';

const path = '/work';

export const metadata: Metadata = buildPageMetadata({
  title: 'Our Work',
  description:
    'The products, websites and systems Unchained Business is building — including TanCerca, our first completed flagship product, alongside the projects currently in development.',
  path,
});

/** Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. See app/page.tsx. */
export const revalidate = 600;

export default async function WorkPage() {
  const projects = await loadProjects();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Our Work', path },
        ])}
      />
      <WorkPageView projects={projects} />
    </>
  );
}
