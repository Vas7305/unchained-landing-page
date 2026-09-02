'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

const phases: { key: string; label: TranslationKey; body: TranslationKey }[] = [
  { key: 'build', label: 'challenge.build.label', body: 'challenge.build.body' },
  { key: 'prove', label: 'challenge.prove.label', body: 'challenge.prove.body' },
  { key: 'scale', label: 'challenge.scale.label', body: 'challenge.scale.body' },
];

// We are transitioning from Build toward Prove.
const CURRENT_PHASE = 1;

export default function Challenge() {
  const t = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.challenge-inner',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );

      // The progress rail fills to the current phase — motion that means something.
      gsap.fromTo(
        '.phase-rail-fill',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.4,
          ease: 'power2.inOut',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: '.phase-rail', start: 'top 85%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='challenge'
      ref={sectionRef}
      className='relative py-24 md:py-28 px-6 overflow-hidden'
      aria-labelledby='challenge-heading'
    >
      <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

      <div className='challenge-inner relative max-w-4xl mx-auto'>
        <div className='text-center'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            {t('challenge.eyebrow')}
          </p>
          <h2
            id='challenge-heading'
            className='text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight gradient-text'
          >
            {t('challenge.title')}
          </h2>
          <p className='mt-4 text-lg md:text-xl text-foreground/80 font-medium'>
            {t('challenge.lede')}
          </p>
        </div>

        {/* Phase rail */}
        <div className='phase-rail mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {phases.map((phase, i) => {
            const isCurrent = i === CURRENT_PHASE;
            const isDone = i < CURRENT_PHASE;
            const railFill = isDone ? 'bg-foreground/60' : 'bg-foreground/25';
            const labelTone =
              isDone || isCurrent
                ? 'text-foreground'
                : 'text-muted-foreground/50';

            return (
              <div key={phase.key} className='flex flex-col gap-3'>
                <div className='relative h-px bg-border overflow-hidden'>
                  {(isDone || isCurrent) && (
                    <div
                      className={`phase-rail-fill absolute inset-0 ${railFill}`}
                    />
                  )}
                </div>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span
                    className={`text-sm font-bold tracking-tight ${labelTone}`}
                  >
                    {t(phase.label)}
                  </span>
                  {isCurrent && (
                    <span className='status-pill border-border text-muted-foreground'>
                      {t('challenge.weAreHere')}
                    </span>
                  )}
                </div>
                <p className='text-sm text-muted-foreground leading-relaxed'>
                  {t(phase.body)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Narrative */}
        <div className='mt-14 glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col gap-6'>
          <div className='flex flex-col gap-4 text-muted-foreground text-base leading-relaxed'>
            <p>{t('challenge.p1')}</p>
            <p>{t('challenge.p2')}</p>
          </div>

          <blockquote className='border-l-2 border-foreground/25 pl-5 md:pl-6'>
            <p className='text-lg md:text-xl font-semibold text-foreground leading-snug tracking-tight'>
              {t('challenge.quote')}
            </p>
          </blockquote>

          <div>
            <Link
              href='/journey'
              onClick={() =>
                track('follow_journey_click', { location: 'challenge' })
              }
              className='group inline-flex items-center gap-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
            >
              {t('common.followTheJourney')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
