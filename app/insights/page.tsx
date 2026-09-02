import type { Metadata } from 'next';
import InsightsIndex from '@/components/InsightsIndex';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

const path = '/insights';

export const metadata: Metadata = buildPageMetadata({
  title: 'Insights',
  description:
    'Writing from Unchained Business on software, business automation and growth systems — the decisions and trade-offs behind the digital infrastructure we build.',
  path,
});

export default function InsightsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Insights', path },
        ])}
      />
      <InsightsIndex />
    </>
  );
}
