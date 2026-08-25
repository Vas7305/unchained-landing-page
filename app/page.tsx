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

export default function Home() {
  return (
    <main id='main' className='min-h-screen relative'>
      <ScrollDepth page='home' />
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
