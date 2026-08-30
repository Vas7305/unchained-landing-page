import type { Metadata } from 'next';
import WorkPageView from '@/components/WorkPageView';

export const metadata: Metadata = {
  title: 'Our Work',
  description:
    'The products, websites and systems Unchained Business is building — including TanCerca, our first completed flagship product, alongside the projects currently in development.',
  alternates: { canonical: '/work' },
};

export default function WorkPage() {
  return <WorkPageView />;
}
