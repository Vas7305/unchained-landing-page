import type { Metadata } from 'next';
import JourneyPageView from '@/components/JourneyPageView';

export const metadata: Metadata = {
  title: 'Building Unchained — The Journey',
  description:
    'An open log of building Unchained Business: what we build, what happens, what we learn, and what changes. Documented as it happens, including the parts that do not work.',
  alternates: { canonical: '/journey' },
};

export default function JourneyPage() {
  return <JourneyPageView />;
}
