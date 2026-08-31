'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StartProjectButton from '@/components/StartProjectButton';
import ScrollDepth from '@/components/ScrollDepth';
import { pillars } from '@/lib/site';
import type { PillarContent } from '@/lib/pillar-content';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * Each pillar's copy lives under its own short dictionary prefix. The offering
 * ids are listed here rather than derived from the content file because the
 * dictionary keys them by concept (`webapps`), not by their English name.
 */
const PILLAR_KEYS = {
  'software-development': {
    prefix: 'sd',
    offerings: ['websites', 'webapps', 'saas', 'custom', 'products'],
  },
  'business-automation': {
    prefix: 'ba',
    offerings: ['workflow', 'integrations', 'tools', 'operational'],
  },
  'growth-systems': {
    prefix: 'gs',
    offerings: ['acquisition', 'qualification', 'nurturing', 'conversion'],
  },
} as const;

const APPROACH_STEPS = [1, 2, 3] as const;

export default function PillarPage({ content }: { content: PillarContent }) {
  const { t, tList } = useLanguage();
  const siblings = pillars.filter((p) => p.slug !== content.slug);
  const { prefix, offerings } = PILLAR_KEYS[content.slug];

  /** Shorthand for this pillar's own namespace. */
  const p = (suffix: string) => t((prefix + '.' + suffix) as TranslationKey);

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page={content.slug} />

      <PageHeader
        eyebrow={p('eyebrow')}
        title={t(('pillar.' + content.slug) as TranslationKey)}
        lede={p('lede')}
      >
        <StartProjectButton
          source='pillar'
          detail={content.slug}
          className='group inline-flex items-center gap-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
        >
          {t('nav.startProject')}
          <ArrowRight
            size={15}
            aria-hidden='true'
            className='group-hover:translate-x-1 transition-transform duration-200'
          />
        </StartProjectButton>
      </PageHeader>

      {/* What we build */}
      <section
        className='px-6 py-16 md:py-24'
        aria-labelledby='offerings-heading'
      >
        <div className='max-w-5xl mx-auto'>
          <h2
            id='offerings-heading'
            className='text-3xl md:text-4xl font-bold tracking-tight gradient-text'
          >
            {t('pillarPage.whatWeBuild')}
          </h2>

          <div className='mt-10 grid grid-cols-1 md:grid-cols-2 gap-5'>
            {offerings.map((id) => (
              <article
                key={id}
                className='glow-border rounded-2xl bg-card p-7 flex flex-col gap-3'
              >
                <h3 className='text-lg font-semibold text-foreground'>
                  {p('offering.' + id + '.name')}
                </h3>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  {p('offering.' + id + '.body')}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How we approach it */}
      <section
        className='px-6 py-16 md:py-24 bg-secondary/20'
        aria-labelledby='approach-heading'
      >
        <div className='max-w-5xl mx-auto'>
          <h2
            id='approach-heading'
            className='text-3xl md:text-4xl font-bold tracking-tight gradient-text'
          >
            {t('pillarPage.howWeApproach')}
          </h2>

          <div className='mt-10 flex flex-col gap-10'>
            {APPROACH_STEPS.map((n) => (
              <article
                key={n}
                className='grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 md:gap-8 items-start'
              >
                <span
                  className='text-sm font-bold text-muted-foreground/40 tabular-nums pt-1'
                  aria-hidden='true'
                >
                  {String(n).padStart(2, '0')}
                </span>
                <div className='max-w-2xl'>
                  <h3 className='text-xl font-semibold text-foreground mb-3'>
                    {p('approach.' + n + '.heading')}
                  </h3>
                  <p className='text-base text-muted-foreground leading-relaxed'>
                    {p('approach.' + n + '.body')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Signals + proof */}
      <section className='px-6 py-16 md:py-24'>
        <div className='max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start'>
          <div>
            <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
              {t('pillarPage.youNeedThis')}
            </h2>
            <ul className='mt-6 flex flex-col gap-3'>
              {tList((prefix + '.signals') as ListKey).map((s) => (
                <li key={s} className='flex items-start gap-3'>
                  <Check
                    size={16}
                    aria-hidden='true'
                    className='mt-0.5 shrink-0 text-muted-foreground'
                  />
                  <span className='text-sm text-muted-foreground leading-relaxed'>
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className='glow-border rounded-2xl bg-card p-8'>
            <h2 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-4'>
              {t('pillarPage.whereWeAre')}
            </h2>
            <p className='text-base text-foreground leading-relaxed'>
              {p('proof')}
            </p>
            <Link
              href='/work'
              className='group mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground'
            >
              {t('pillarPage.seeOurWork')}
              <ArrowRight
                size={14}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
          </div>
        </div>
      </section>

      {/* Sibling pillars */}
      <section
        className='px-6 pb-24 md:pb-28'
        aria-labelledby='other-capabilities-heading'
      >
        <div className='max-w-5xl mx-auto'>
          <h2
            id='other-capabilities-heading'
            className='text-xs uppercase tracking-widest text-muted-foreground mb-6 font-medium'
          >
            {t('pillarPage.otherPillars')}
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
            {siblings.map((sibling) => (
              <Link
                key={sibling.slug}
                href={`/${sibling.slug}`}
                className='group glow-border rounded-2xl bg-card p-7 hover:border-foreground/25 hover:bg-accent/25 transition-all duration-300'
              >
                <span className='text-xs font-bold tracking-widest text-muted-foreground/40 tabular-nums'>
                  {sibling.number}
                </span>
                <h3 className='mt-2 text-lg font-semibold text-foreground flex items-center gap-2'>
                  {t(('pillar.' + sibling.slug) as TranslationKey)}
                  <ArrowRight
                    size={15}
                    aria-hidden='true'
                    className='text-muted-foreground group-hover:translate-x-1 transition-transform duration-200'
                  />
                </h3>
                <p className='mt-2 text-sm text-muted-foreground leading-relaxed'>
                  {t(('pillarSummary.' + sibling.slug) as TranslationKey)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
