'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { track } from '@/lib/analytics';
import StartProjectButton from '@/components/StartProjectButton';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

const stageFacts: { value: string; key: TranslationKey }[] = [
  { value: '01', key: 'hero.factFlagship' },
  { value: '05', key: 'hero.factInDevelopment' },
  { value: '03', key: 'hero.factPillars' },
];

export default function Hero() {
  const t = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const factsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.5 });

      tl.fromTo(
        badgeRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      )
        .fromTo(
          h1Ref.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
          '-=0.3',
        )
        .fromTo(
          descRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
          '-=0.4',
        )
        .fromTo(
          ctaRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
          '-=0.3',
        )
        .fromTo(
          factsRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
          '-=0.3',
        )
        .fromTo(
          scrollRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          '-=0.1',
        );

      // Floating orbs
      gsap.to(orb1Ref.current, {
        y: -30,
        x: 15,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to(orb2Ref.current, {
        y: 20,
        x: -20,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 1,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className='relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-20'
    >
      {/* Background grid */}
      <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

      {/* Orbs */}
      <div
        ref={orb1Ref}
        aria-hidden='true'
        className='absolute top-1/4 right-1/4 w-125 h-125 rounded-full pointer-events-none'
        style={{
          background:
            'radial-gradient(circle, rgba(160,160,176,0.07) 0%, transparent 70%)',
        }}
      />
      <div
        ref={orb2Ref}
        aria-hidden='true'
        className='absolute bottom-1/4 left-1/4 w-100 h-100 rounded-full pointer-events-none'
        style={{
          background:
            'radial-gradient(circle, rgba(100,100,120,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className='relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center gap-8'>
        {/* Badge */}
        <div
          ref={badgeRef}
          className='inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground tracking-wide uppercase'
        >
          <span
            className='w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse'
            aria-hidden='true'
          />
          {t('hero.badge')}
        </div>

        {/* Headline */}
        <h1
          ref={h1Ref}
          className='text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] tracking-tight'
        >
          <span className='gradient-text'>{t('hero.headlineLead')}</span>
          <br />
          <span className='text-foreground'>{t('hero.headlineTail')}</span>
        </h1>

        {/* Sub */}
        <p
          ref={descRef}
          className='max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed'
        >
          {t('hero.description')}
        </p>

        {/* CTAs */}
        <div
          ref={ctaRef}
          className='flex flex-col sm:flex-row items-center gap-4'
        >
          <StartProjectButton
            source='hero'
            className='group inline-flex items-center gap-2 bg-foreground text-background font-semibold px-7 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200 shadow-lg'
          >
            {t('nav.startProject')}
            <ArrowRight
              size={16}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </StartProjectButton>
          <Link
            href='/work'
            onClick={() => track('explore_work_click', { location: 'hero' })}
            className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 px-4 py-3.5 underline decoration-border underline-offset-8 hover:decoration-foreground/40'
          >
            {t('common.exploreOurWork')}
          </Link>
        </div>

        {/* Honest stage indicator — capability, not commercial claims */}
        <div
          ref={factsRef}
          className='flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-2'
        >
          {stageFacts.map((f) => (
            <div key={f.key} className='flex items-center gap-2.5'>
              <span className='text-sm font-bold text-foreground tabular-nums'>
                {f.value}
              </span>
              <span className='text-xs text-muted-foreground'>{t(f.key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div
        ref={scrollRef}
        aria-hidden='true'
        className='absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/40'
      >
        <span className='text-[10px] uppercase tracking-widest'>
          {t('hero.scroll')}
        </span>
        <ChevronDown size={16} className='animate-bounce' />
      </div>
    </section>
  );
}
