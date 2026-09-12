'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ScrollDepth from '@/components/ScrollDepth';
import {
  formatInsightDate,
  insightPath,
  type InsightArticle,
  type InsightCopy,
} from '@/lib/insights';
import { pillars } from '@/lib/site';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { Locale } from '@/lib/i18n/config';
import { localize } from '@/lib/cms/localized';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * One entry in the index. The heading carries the link rather than the whole
 * card, so the pillar link beside it is a sibling anchor and not a nested one.
 */
function ArticleCard({
  article,
  locale,
  t,
}: {
  article: InsightArticle;
  locale: Locale;
  t: (key: TranslationKey) => string;
}) {
  // The card's own words in the visitor's language, falling back field by
  // field to the default locale. The date, the pillar and the URL are not
  // translated: they are the same fact in every language.
  const copy = localize<InsightCopy>(article, article.translations, locale);

  return (
    <article className='glow-border rounded-2xl bg-card p-7 flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <Link
          href={`/${article.pillar}`}
          className='status-pill border-border text-muted-foreground hover:text-foreground transition-colors duration-200'
        >
          {t(('pillar.' + article.pillar) as TranslationKey)}
        </Link>
        <time
          dateTime={article.publishedAt}
          className='text-xs text-muted-foreground/60'
        >
          {formatInsightDate(article.publishedAt, locale)}
        </time>
      </div>

      <h2 className='text-xl font-semibold text-foreground'>
        <Link
          href={insightPath(article.slug)}
          className='group inline-flex items-start gap-1.5 hover:text-foreground/80 transition-colors duration-200'
        >
          {copy.title}
          <ArrowRight
            size={15}
            aria-hidden='true'
            className='mt-1.5 shrink-0 text-muted-foreground group-hover:translate-x-1 transition-transform duration-200'
          />
        </Link>
      </h2>

      <p className='text-sm text-muted-foreground leading-relaxed'>
        {copy.description}
      </p>
    </article>
  );
}

export default function InsightsIndex({
  articles,
}: {
  /**
   * The published articles, read from the CMS by the route.
   *
   * Passed in rather than imported. This component used to read the typed
   * array in lib/insights.ts directly, which stopped being the source of truth
   * when the editorial layer moved into the database — a client component
   * importing it would render the fallback list beside a page rendering the
   * live one.
   */
  articles: InsightArticle[];
}) {
  const { t, locale } = useLanguage();

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page='insights' />

      <PageHeader
        eyebrow={t('insightsPage.eyebrow')}
        title={t('insightsPage.title')}
        accent={t('insightsPage.titleAccent')}
        lede={t('insightsPage.lede')}
      />

      <section className='px-6 pb-24 md:pb-28' aria-label={t('insightsPage.articles')}>
        <div className='max-w-5xl mx-auto flex flex-col gap-10'>
          {articles.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              {articles.map((article) => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          ) : (
            /* Nothing is published yet, and we say so rather than filling the
               page with something written for a crawler. */
            <div className='glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col gap-5'>
              <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
                {t('insightsPage.empty.title')}
              </h2>
              <p className='text-muted-foreground leading-relaxed max-w-2xl'>
                {t('insightsPage.empty.body')}
              </p>
              <p className='text-muted-foreground leading-relaxed max-w-2xl'>
                {t('insightsPage.empty.journey')}
              </p>
              <div className='flex flex-col sm:flex-row gap-3 mt-1'>
                <Link
                  href='/journey'
                  className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
                >
                  {t('common.followTheJourney')}
                  <ArrowRight
                    size={15}
                    aria-hidden='true'
                    className='group-hover:translate-x-1 transition-transform duration-200'
                  />
                </Link>
                <Link
                  href='/work'
                  className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-colors duration-200'
                >
                  {t('common.exploreOurWork')}
                </Link>
              </div>
            </div>
          )}

          {/* The three pillars are what the writing will be organised around,
              so the index reaches them whether or not it has articles yet. */}
          <nav aria-label={t('nav.whatWeBuild')} className='flex flex-col gap-4'>
            <h2 className='text-xs uppercase tracking-widest text-muted-foreground font-medium'>
              {t('insightsPage.pillarsHeading')}
            </h2>
            <ul className='grid grid-cols-1 sm:grid-cols-3 gap-5'>
              {pillars.map((pillar) => (
                <li key={pillar.slug}>
                  <Link
                    href={`/${pillar.slug}`}
                    className='group glow-border rounded-2xl bg-card p-6 flex flex-col gap-2 h-full hover:border-foreground/25 hover:bg-accent/25 transition-colors duration-300'
                  >
                    <span className='text-xs font-bold tracking-widest text-muted-foreground/40 tabular-nums'>
                      {pillar.number}
                    </span>
                    <span className='text-base font-semibold text-foreground flex items-center gap-2'>
                      {t(('pillar.' + pillar.slug) as TranslationKey)}
                      <ArrowRight
                        size={14}
                        aria-hidden='true'
                        className='text-muted-foreground group-hover:translate-x-1 transition-transform duration-200'
                      />
                    </span>
                    <span className='text-sm text-muted-foreground leading-relaxed'>
                      {t(('pillarSummary.' + pillar.slug) as TranslationKey)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </main>
  );
}
