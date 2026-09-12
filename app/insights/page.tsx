import type { Metadata } from 'next';
import InsightsIndex from '@/components/InsightsIndex';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';
import { loadInsights } from '@/lib/editorial';

const path = '/insights';

/**
 * Ten minutes, matching EDITORIAL_REVALIDATE_SECONDS. See lib/editorial.ts for
 * why the value is written out as a literal rather than imported.
 *
 * The index is regenerated on the same schedule as the articles it lists and
 * as the sitemap, so the three cannot drift apart by more than one interval —
 * and publishing in the panel asks for a revalidation immediately, making this
 * the floor rather than the normal path.
 */
export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: 'Insights',
  description:
    'Writing from Unchained Business on software, business automation and growth systems — the decisions and trade-offs behind the digital infrastructure we build.',
  path,
});

export default async function InsightsPage() {
  // Read on the server so the index ships prerendered. A client-side fetch
  // would put the article list behind a request the visitor waits for and a
  // crawler may not make, on a page whose whole purpose is to be indexed.
  const articles = await loadInsights();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Insights', path },
        ])}
      />
      <InsightsIndex articles={articles} />
    </>
  );
}
