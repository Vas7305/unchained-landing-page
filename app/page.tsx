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
import { loadProjects } from '@/lib/portfolio';
import { featuredOf, othersOf } from '@/lib/projects';

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

/**
 * Ten minutes, matching PORTFOLIO_REVALIDATE_SECONDS. Written as a literal
 * because Next requires this value to be statically analysable and will not
 * follow an import to find it; lib/portfolio.ts lists every route that has to
 * be changed alongside it.
 */
export const revalidate = 600;

export default async function Home() {
  const projects = await loadProjects();

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
      <Work featured={featuredOf(projects)} others={othersOf(projects)} />
      <Challenge />
      <About />
      <HowItWorks />
      <Services />
      <FAQ />
      <CTASection />
    </main>
  );
}
