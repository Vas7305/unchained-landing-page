import type { Metadata } from 'next';
import WorkPageView from '@/components/WorkPageView';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

const path = '/work';

export const metadata: Metadata = buildPageMetadata({
  title: 'Our Work',
  description:
    'The products, websites and systems Unchained Business is building — including TanCerca, our first completed flagship product, alongside the projects currently in development.',
  path,
});

export default function WorkPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Our Work', path },
        ])}
      />
      <WorkPageView />
    </>
  );
}
