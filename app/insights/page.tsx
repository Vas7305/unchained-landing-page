import type { Metadata } from 'next';
import InsightsIndex from '@/components/InsightsIndex';

export const metadata: Metadata = {
  title: 'Insights',
  description:
    'Writing from Unchained Business on software, business automation and growth systems — the decisions and trade-offs behind the digital infrastructure we build.',
  alternates: { canonical: '/insights' },
};

export default function InsightsPage() {
  return <InsightsIndex />;
}
