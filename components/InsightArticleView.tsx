'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ScrollDepth from '@/components/ScrollDepth';
import StartProjectButton from '@/components/StartProjectButton';
import {
  formatInsightDate,
  insightPath,
  resolveRelated,
  type InsightArticle,
} from '@/lib/insights';
import { getProject } from '@/lib/projects';
import { getPillar } from '@/lib/site';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * The shape every Insights article renders in.
 *
 * Article prose comes from the article object rather than from the dictionary:
 * unlike the site's chrome, a piece of writing is not a string that can be
 * swapped per locale, and pretending otherwise would mean shipping six
 * placeholder translations of every paragraph. The furniture around it — the
 * labels, headings and CTA — is translated like everything else on the site.
 */
export default function InsightArticleView({
  article,
}: {
  article: InsightArticle;
}) {
  const { t, locale } = useLanguage();
  const pillar = getPillar(article.pillar);
  const pillarName = t(('pillar.' + pillar.slug) as TranslationKey);
  const related = resolveRelated(article);
  const caseStudy = article.caseStudySlug
    ? getProject(article.caseStudySlug)
    : undefined;

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page={`insights/${article.slug}`} />

      {/* Header */}
      <section className='relative overflow-hidden px-6 pt-32 pb-12 md:pt-40'>
        <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

        <div className='relative max-w-3xl mx-auto'>
          <Link
            href='/insights'
            className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
          >
            <ArrowLeft size={14} aria-hidden='true' />
            {t('article.allInsights')}
          </Link>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <Link
              href={`/${pillar.slug}`}
              className='status-pill border-border text-muted-foreground hover:text-foreground transition-colors duration-200'
            >
              {pillarName}
            </Link>
            <span className='text-xs text-muted-foreground'>
              {t('article.published')}{' '}
              <time dateTime={article.publishedAt}>
                {formatInsightDate(article.publishedAt, locale)}
              </time>
            </span>
            {article.updatedAt && (
              <span className='text-xs text-muted-foreground/60'>
                {t('article.updated')}{' '}
                <time dateTime={article.updatedAt}>
                  {formatInsightDate(article.updatedAt, locale)}
                </time>
              </span>
            )}
          </div>

          <h1 className='mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] gradient-text'>
            {article.title}
          </h1>

          <p className='mt-6 text-lg text-muted-foreground leading-relaxed'>
            {article.lede}
          </p>
        </div>
      </section>

      {/* Body */}
      <article className='px-6 pb-16'>
        <div className='max-w-3xl mx-auto flex flex-col gap-12'>
          {article.sections.map((section) => (
            <section key={section.heading} className='flex flex-col gap-4'>
              <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className='text-base text-muted-foreground leading-relaxed'
                >
                  {paragraph}
                </p>
              ))}
              {section.points && (
                <ul className='flex flex-col gap-2 mt-1'>
                  {section.points.map((point) => (
                    <li
                      key={point}
                      className='glow-border rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground leading-relaxed'
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      {/* Where this sits in what we build */}
      <section className='px-6 pb-16' aria-labelledby='article-pillar-heading'>
        <div className='max-w-3xl mx-auto glow-border rounded-2xl bg-card p-8 flex flex-col gap-3'>
          <h2
            id='article-pillar-heading'
            className='text-xs uppercase tracking-widest text-muted-foreground/60'
          >
            {t('article.pillarHeading')}
          </h2>
          <p className='text-base text-foreground leading-relaxed'>
            {t(('pillarSummary.' + pillar.slug) as TranslationKey)}
          </p>
          <Link
            href={`/${pillar.slug}`}
            className='group inline-flex items-center gap-2 text-sm font-medium text-foreground w-fit'
          >
            {pillarName}
            <ArrowRight
              size={14}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </Link>

          {caseStudy && (
            <Link
              href={`/work/${caseStudy.slug}`}
              className='group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 w-fit'
            >
              {t('article.caseStudy')}: {caseStudy.title}
              <ArrowRight
                size={14}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
          )}
        </div>
      </section>

      {/* Editorially chosen further reading — never generated. */}
      {related.length > 0 && (
        <section
          className='px-6 pb-16'
          aria-labelledby='related-reading-heading'
        >
          <div className='max-w-3xl mx-auto'>
            <h2
              id='related-reading-heading'
              className='text-xs uppercase tracking-widest text-muted-foreground mb-6 font-medium'
            >
              {t('article.relatedReading')}
            </h2>
            <ul className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
              {related.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={insightPath(other.slug)}
                    className='group glow-border rounded-2xl bg-card p-6 flex flex-col gap-2 h-full hover:border-foreground/25 hover:bg-accent/25 transition-colors duration-300'
                  >
                    <span className='text-base font-semibold text-foreground flex items-start gap-2'>
                      {other.title}
                      <ArrowRight
                        size={14}
                        aria-hidden='true'
                        className='mt-1 shrink-0 text-muted-foreground group-hover:translate-x-1 transition-transform duration-200'
                      />
                    </span>
                    <span className='text-sm text-muted-foreground leading-relaxed'>
                      {other.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Next step — the one CTA the whole site uses. */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-3xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col gap-5'>
          <h2 className='text-2xl md:text-3xl font-bold tracking-tight'>
            <span className='gradient-text'>{t('article.ctaTitle')}</span>{' '}
            <span className='text-foreground'>{t('article.ctaAccent')}</span>
          </h2>
          <p className='text-muted-foreground leading-relaxed max-w-xl'>
            {t('article.ctaBody')}
          </p>
          <div className='flex flex-col sm:flex-row gap-3'>
            <StartProjectButton
              source='insight'
              detail={article.slug}
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
            >
              {t('nav.startProject')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </StartProjectButton>
            <Link
              href='/insights'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors duration-200'
            >
              {t('article.allInsights')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
