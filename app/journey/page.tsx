import type { Metadata } from 'next';
import JourneyPageView from '@/components/JourneyPageView';
import JsonLd from '@/components/JsonLd';
import { buildPageMetadata } from '@/lib/metadata';
import { breadcrumbSchema } from '@/lib/structured-data';

const path = '/journey';

export const metadata: Metadata = buildPageMetadata({
  title: 'Building Unchained — The Journey',
  description:
    'An open log of building Unchained Business: what we build, what happens, what we learn, and what changes. Documented as it happens, including the parts that do not work.',
  path,
});

export default function JourneyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Journey', path },
        ])}
      />
      <JourneyPageView />
    </>
  );
}
