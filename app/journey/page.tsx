import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import JourneyTimeline from '@/components/JourneyTimeline';
import ScrollDepth from '@/components/ScrollDepth';
import { currentStage, journeyEntries } from '@/lib/journey';

export const metadata: Metadata = {
  title: 'Building Unchained — The Journey',
  description:
    'An open log of building Unchained Business: what we build, what happens, what we learn, and what changes. Documented as it happens, including the parts that do not work.',
  alternates: { canonical: '/journey' },
};

const principles = [
  {
    title: "We don't hide mistakes.",
    body: 'If something we built underperformed or an assumption was wrong, it goes in the log.',
  },
  {
    title: "We don't exaggerate wins.",
    body: 'A shipped product is a shipped product. It is not a market position.',
  },
  {
    title: "We don't fabricate numbers.",
    body: 'Any figure published here is one we can show evidence for. Until then, we describe capability instead.',
  },
  {
    title: "We don't manufacture authority.",
    body: 'We are early. The log exists so you can judge us by what we accomplish, not by how we describe ourselves.',
  },
];

export default function JourneyPage() {
  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page='journey' />

      <PageHeader
        eyebrow='The Unchained Challenge'
        title='Building Unchained.'
        lede='Build a global technology company, one project at a time — documented in the open. This is the log: what we build, what happens, what we learn, and what changes as a result.'
      >
        <div className='glow-border rounded-2xl bg-card p-6 md:p-8 max-w-3xl'>
          <div className='flex flex-wrap items-center gap-3 mb-6'>
            <span className='status-pill border-border text-foreground'>
              {currentStage.label}
            </span>
            <span className='text-xs text-muted-foreground'>
              As of {currentStage.since}
            </span>
          </div>
          <dl className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            {currentStage.facts.map((fact) => (
              <div key={fact.label} className='flex flex-col gap-1'>
                <dt className='sr-only'>{fact.label}</dt>
                <dd className='text-2xl md:text-3xl font-extrabold text-foreground tabular-nums'>
                  {fact.value}
                </dd>
                <p
                  aria-hidden='true'
                  className='text-xs text-muted-foreground leading-snug'
                >
                  {fact.label}
                </p>
              </div>
            ))}
          </dl>
        </div>
      </PageHeader>

      {/* Transparency principles */}
      <section
        className='px-6 py-16 md:py-20 bg-secondary/20'
        aria-labelledby='principles-heading'
      >
        <div className='max-w-5xl mx-auto'>
          <h2
            id='principles-heading'
            className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'
          >
            How this log works
          </h2>
          <p className='mt-3 text-muted-foreground max-w-2xl leading-relaxed'>
            Build. Measure. Document. Improve. Scale. This page is the
            &ldquo;document&rdquo; step, and it is deliberately unlike a
            corporate blog.
          </p>

          <ul className='mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5'>
            {principles.map((p) => (
              <li
                key={p.title}
                className='glow-border rounded-2xl bg-card p-6 flex flex-col gap-2'
              >
                <h3 className='text-sm font-semibold text-foreground'>
                  {p.title}
                </h3>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  {p.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Timeline */}
      <section className='px-6 py-20 md:py-24' aria-labelledby='log-heading'>
        <div className='max-w-5xl mx-auto'>
          <h2
            id='log-heading'
            className='text-xs uppercase tracking-widest text-muted-foreground mb-12 font-medium'
          >
            The Log
          </h2>
          <JourneyTimeline entries={journeyEntries} />
        </div>
      </section>

      {/* Next */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-5xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8'>
          <div className='max-w-xl'>
            <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
              The next entry gets written by what happens next.
            </h2>
            <p className='mt-4 text-muted-foreground leading-relaxed'>
              If you want to be part of it — as a client, a collaborator, or
              someone with a problem worth solving — start there.
            </p>
          </div>
          <div className='flex flex-col sm:flex-row md:flex-col gap-3 shrink-0'>
            <Link
              href='/#contact'
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              Start a Project
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
            <Link
              href='/work'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200'
            >
              Explore Our Work
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
