import type { Metadata } from 'next';
import PillarPage from '@/components/PillarPage';
import JsonLd from '@/components/JsonLd';
import { pillarContent } from '@/lib/pillar-content';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

const content = pillarContent['business-automation'];
const path = '/business-automation';

export const metadata: Metadata = buildPageMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path,
});

export default function Page() {
  return (
    <>
      {/* One level below the home page. Structured data only: the page opens
          with its own "Capability 0n" eyebrow and a visible trail here would
          repeat the navbar rather than orient anyone. */}
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: content.title, path },
        ])}
      />
      <PillarPage content={content} />
    </>
  );
}
