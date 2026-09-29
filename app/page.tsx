import Hero from '@/components/Hero';
import Offers from '@/components/Offers';
import Languages from '@/components/Languages';
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
import { getDemo } from '@/lib/demo/registry';
import { offers } from '@/lib/offers';

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

/**
 * The order is the argument the page makes to a first-time visitor:
 *
 *   what we sell (Hero) → in your customers' language (Languages) → what
 *   you can buy (Offers) → proof we can build it (Work, the demos) → how we
 *   work (HowItWorks, Services) → the strategic capabilities underneath
 *   (PainPoints, Capabilities) → who we are, honestly (Challenge, About) →
 *   questions (FAQ) → start (CTASection).
 */
export default async function Home() {
  const projects = await loadProjects();

  // The demos a visitor can actually open: published AND present in the
  // registry — the same join app/work/[slug]/demo applies.
  const withDemo = projects.filter((p) => getDemo(p.slug));
  const demoLanguages = [
    ...new Set(withDemo.map((p) => getDemo(p.slug)!.lang.split('-')[0])),
  ];
  const offerExamples = new Set(offers.flatMap((o) => o.examples));

  return (
    <main id='main' className='min-h-screen relative'>
      {/* The page's one background: the blueprint grid, pinned to the
          viewport so it stays still while the sections and their cards
          scroll over it. A fixed element rather than
          `background-attachment: fixed`, which iOS Safari ignores and which
          repaints on every scroll frame elsewhere. Sections carry no
          background of their own, so it shows through all of them. */}
      <div
        aria-hidden='true'
        className='fixed inset-0 -z-10 pointer-events-none blueprint-grid'
      />
      <ScrollDepth page='home' />
      {/* Describes the seven questions the FAQ section below actually
          publishes — nothing was written to obtain this schema. English,
          because that is the language of the prerendered document. */}
      <JsonLd data={faqPageSchema(englishFaqEntries())} />
      <Hero demoCount={withDemo.length} />
      <Languages demoLanguages={demoLanguages} />
      <Offers examples={withDemo.filter((p) => offerExamples.has(p.slug))} />
      <Work featured={featuredOf(projects)} others={othersOf(projects)} />
      <HowItWorks />
      <Services />
      <PainPoints />
      <Capabilities />
      <Challenge />
      <About />
      <FAQ />
      <CTASection />
    </main>
  );
}
