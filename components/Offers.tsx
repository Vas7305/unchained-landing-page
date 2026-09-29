'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, PlayCircle } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import StartProjectButton from '@/components/StartProjectButton';
import { track } from '@/lib/analytics';
import { demoPath } from '@/lib/demo/registry';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { languageName } from '@/lib/i18n/languageName';
import { useProjectCopy } from '@/lib/cms/projectCopy';
import {
  formatPrice,
  offers,
  publishedPrice,
  type Offer,
} from '@/lib/offers';
import type { Project } from '@/lib/projects';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

/**
 * "What can I buy?" — the homepage's answer, directly under the hero.
 *
 * Three offers from lib/offers.ts. Each card is built around the buying
 * decision: who it is for, what it solves, a working example, what it costs
 * and how long it takes, and one button. Where a commercial fact is not
 * defined yet the card says what is true instead — that it is agreed on the
 * free intro call — rather than printing a placeholder.
 *
 * `examples` arrives from the server already filtered to published projects
 * that have a demo, so a card can only link to a demo page that exists.
 */
export default function Offers({ examples }: { examples: Project[] }) {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.offer-card',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='offers'
      ref={sectionRef}
      className='py-12 md:py-14 px-6'
      aria-labelledby='offers-heading'
    >
      <div className='max-w-6xl mx-auto'>
        <SectionHeading
          eyebrow={t('offers.eyebrow')}
          title={t('offers.title')}
          accent={t('offers.titleAccent')}
          titleId='offers-heading'
          body={t('offers.body')}
        />

        <ul className='mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch'>
          {offers.map((offer) => (
            <li key={offer.id} className='offer-card'>
              <OfferCard
                offer={offer}
                examples={examples.filter((p) =>
                  offer.examples.includes(p.slug),
                )}
              />
            </li>
          ))}
        </ul>

        {/* What pressing any of these buttons actually does. There is no
            checkout behind them, and the page says so. */}
        <p className='mt-10 text-center text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto'>
          {t('offers.note')}
        </p>
      </div>
    </section>
  );
}

const labelClass =
  'text-[11px] uppercase tracking-widest text-muted-foreground/80 font-medium';

function OfferCard({ offer, examples }: { offer: Offer; examples: Project[] }) {
  const { t, tList, locale } = useLanguage();
  const price = publishedPrice(offer);
  const nameId = `offer-${offer.id}-name`;

  return (
    <article
      aria-labelledby={nameId}
      className='h-full glow-border rounded-2xl bg-card p-7 md:p-8 flex flex-col gap-6'
    >
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
        <span className='text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-secondary text-muted-foreground'>
          {t('offers.offer')} {offer.id.toUpperCase()}
        </span>
        <span className='text-xs text-muted-foreground'>
          {t('offers.partOf')}{' '}
          <Link
            href={`/${offer.pillar}`}
            className='text-foreground/80 hover:text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground/40 transition-colors'
          >
            {t(('pillar.' + offer.pillar) as TranslationKey)}
          </Link>
        </span>
      </div>

      <h3
        id={nameId}
        className='text-2xl font-bold tracking-tight text-foreground'
      >
        {t(offer.name)}
      </h3>

      <dl className='flex flex-col gap-4 text-sm'>
        <div>
          <dt className={`${labelClass} mb-1`}>{t('offers.for')}</dt>
          <dd className='text-muted-foreground leading-relaxed'>
            {t(offer.audience)}
          </dd>
        </div>
        <div>
          <dt className={`${labelClass} mb-1`}>{t('offers.solves')}</dt>
          <dd className='text-muted-foreground leading-relaxed'>
            {t(offer.problem)}
          </dd>
        </div>
        {offer.includes && (
          <div>
            <dt className={`${labelClass} mb-1`}>{t('offers.includes')}</dt>
            <dd>
              <ul className='flex flex-col gap-1.5 text-muted-foreground'>
                {tList(offer.includes).map((item) => (
                  <li key={item} className='flex items-start gap-2'>
                    <span
                      className='mt-2 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0'
                      aria-hidden='true'
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {offer.languages && (
          <div>
            <dt className={`${labelClass} mb-1`}>{t('offers.languages')}</dt>
            <dd className='text-muted-foreground'>
              {offer.languages.map((l) => languageName(l, locale)).join(' · ')}
            </dd>
          </div>
        )}
      </dl>

      {examples.length > 0 && (
        <div>
          <p className={`${labelClass} mb-2`}>{t('offers.example')}</p>
          <ul className='flex flex-wrap gap-2'>
            {examples.map((project) => (
              <li key={project.slug}>
                <ExampleLink project={project} offerId={offer.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='mt-auto flex flex-col gap-5 border-t border-border pt-5'>
        <dl className='grid grid-cols-2 gap-4'>
          <div>
            <dt className={`${labelClass} mb-1`}>{t('offers.investment')}</dt>
            <dd
              className={
                price
                  ? 'text-xl font-bold text-foreground tabular-nums'
                  : 'text-sm text-foreground/90 leading-snug'
              }
            >
              {price
                ? `${t('offers.from')} ${formatPrice(price, locale)}`
                : t('offers.quoteOnCall')}
            </dd>
          </div>
          <div>
            <dt className={`${labelClass} mb-1`}>{t('offers.timeline')}</dt>
            <dd className='text-sm text-foreground/90 leading-snug'>
              {offer.delivery ? t(offer.delivery) : t('offers.timelineOnCall')}
            </dd>
          </div>
        </dl>

        <StartProjectButton
          source='offers'
          detail={`offer_${offer.id}`}
          className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold rounded-xl text-sm py-3 px-5 hover:bg-foreground/90 transition-colors duration-200'
        >
          {t(offer.cta)}
          <ArrowRight
            size={14}
            aria-hidden='true'
            className='group-hover:translate-x-1 transition-transform duration-200'
          />
        </StartProjectButton>
      </div>
    </article>
  );
}

/** A demo link named by the project, in the visitor's language. */
function ExampleLink({
  project,
  offerId,
}: {
  project: Project;
  offerId: Offer['id'];
}) {
  const { t } = useLanguage();
  const copy = useProjectCopy(project);

  return (
    <Link
      href={demoPath(project.slug)}
      onClick={() =>
        track('demo_cta_click', {
          project: project.slug,
          location: 'offers',
          offer: offerId,
        })
      }
      className='inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-2.5 py-1.5 transition-colors duration-200'
    >
      <PlayCircle size={13} aria-hidden='true' />
      {copy.title}
      {/* The visible label is the product; what the link opens is said too. */}
      <span className='sr-only'> — {t('demo.cardCta')}</span>
    </Link>
  );
}
