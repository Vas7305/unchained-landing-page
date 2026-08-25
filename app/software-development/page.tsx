import type { Metadata } from 'next';
import PillarPage from '@/components/PillarPage';
import { pillarContent } from '@/lib/pillar-content';

const content = pillarContent['software-development'];

export const metadata: Metadata = {
  title: content.metaTitle,
  description: content.metaDescription,
  alternates: { canonical: '/software-development' },
};

export default function Page() {
  return <PillarPage content={content} />;
}
