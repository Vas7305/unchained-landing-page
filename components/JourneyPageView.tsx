'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import JourneyTimeline from '@/components/JourneyTimeline';
import ScrollDepth from '@/components/ScrollDepth';
import { journeyEntries } from '@/lib/journey';
import StartProjectButton from '@/components/StartProjectButton';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

const principles: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'journeyPage.p1.title', body: 'journeyPage.p1.body' },
  { title: 'journeyPage.p2.title', body: 'journeyPage.p2.body' },
  { title: 'journeyPage.p3.title', body: 'journeyPage.p3.body' },
  { title: 'journeyPage.p4.title', body: 'journeyPage.p4.body' },
];

export default function JourneyPageView() {
  const t = useTranslation();

  /** Counts stay numeric; the spans and their labels are translated. */
  const facts = [
    { value: t('stage.fact.domainValue'), label: t('stage.fact.domain') },
    { value: '1', label: t('stage.fact.flagship') },
    { value: '5', label: t('stage.fact.inDev') },
    { value: t('stage.fact.horizonValue'), label: t('stage.fact.horizon') },
  ];

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page='journey' />

      <PageHeader
        eyebrow={t('journeyPage.eyebrow')}
        title={t('journeyPage.title')}
        lede={t('journeyPage.lede')}
      >
        <div className='glow-border rounded-2xl bg-card p-6 md:p-8 max-w-3xl'>
          <div className='flex flex-wrap items-center gap-3 mb-6'>
            <span className='status-pill border-border text-foreground'>
              {t('stage.label')}
            </span>
            <span className='text-xs text-muted-foreground'>
              {t('journeyPage.asOf')} {t('stage.since')}
            </span>
          </div>
          <dl className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            {facts.map((fact) => (
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
            {t('journeyPage.howLogWorks')}
          </h2>
          <p className='mt-3 text-muted-foreground max-w-2xl leading-relaxed'>
            {t('journeyPage.howLogBody')}
          </p>

          <ul className='mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5'>
            {principles.map((p) => (
              <li
                key={p.title}
                className='glow-border rounded-2xl bg-card p-6 flex flex-col gap-2'
              >
                <h3 className='text-sm font-semibold text-foreground'>
                  {t(p.title)}
                </h3>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  {t(p.body)}
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
            {t('journeyPage.theLog')}
          </h2>
          <JourneyTimeline entries={journeyEntries} />
        </div>
      </section>

      {/* Next */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-5xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8'>
          <div className='max-w-xl'>
            <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
              {t('journeyPage.nextTitle')}
            </h2>
            <p className='mt-4 text-muted-foreground leading-relaxed'>
              {t('journeyPage.nextBody')}
            </p>
          </div>
          <div className='flex flex-col sm:flex-row md:flex-col gap-3 shrink-0'>
            <StartProjectButton
              source='journey'
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
            >
              {t('nav.startProject')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </StartProjectButton>
            <Link
              href='/work'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-colors duration-200'
            >
              {t('common.exploreOurWork')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
