import type { Metadata } from 'next';
import PillarPage from '@/components/PillarPage';
import { pillarContent } from '@/lib/pillar-content';

const content = pillarContent['business-automation'];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: '/business-automation' },
};

export default function Page() {
  return <PillarPage content={content} />;
}
