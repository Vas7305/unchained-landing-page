import Hero from '@/components/Hero';
import PainPoints from '@/components/PainPoints';
import Capabilities from '@/components/Capabilities';
import Work from '@/components/Work';
import Challenge from '@/components/Challenge';
import About from '@/components/About';
import HowItWorks from '@/components/HowItWorks';
import Services from '@/components/Services';
import FAQ from '@/components/FAQ';
import CTASection from '@/components/CTASection';
import ScrollDepth from '@/components/ScrollDepth';
import JsonLd from '@/components/JsonLd';
import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata';
import { siteConfig } from '@/lib/site';
import { englishFaqEntries } from '@/lib/faq';
import { faqPageSchema } from '@/lib/structured-data';

/**
 * The homepage's own metadata. It lived in the root layout until now, where it
 * doubled as every other route's Open Graph block; it belongs to this page.
 * The title is absolute because it already ends in the company name.
 */
export const metadata: Metadata = buildPageMetadata({
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  titleAbsolute: true,
  description: siteConfig.description,
  path: '/',
});

export default function Home() {
  return (
    <main id='main' className='min-h-screen relative'>
      <ScrollDepth page='home' />
      {/* Describes the seven questions the FAQ section below actually
          publishes — nothing was written to obtain this schema. English,
          because that is the language of the prerendered document. */}
      <JsonLd data={faqPageSchema(englishFaqEntries())} />
      <Hero />
      <PainPoints />
      <Capabilities />
      <Work />
      <Challenge />
      <About />
      <HowItWorks />
      <Services />
      <FAQ />
      <CTASection />
    </main>
  );
}
