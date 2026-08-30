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

const principles: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'about.build.title', body: 'about.build.body' },
  { title: 'about.measure.title', body: 'about.measure.body' },
  { title: 'about.document.title', body: 'about.document.body' },
  { title: 'about.improve.title', body: 'about.improve.body' },
  { title: 'about.scale.title', body: 'about.scale.body' },
];

export default function About() {
  const t = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.about-col',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );

      gsap.fromTo(
        '.principle-step',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.principle-list', start: 'top 85%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='about'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 bg-secondary/20'
      aria-labelledby='about-heading'
    >
      <div className='max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start'>
        {/* Narrative */}
        <div className='about-col'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            {t('about.eyebrow')}
          </p>
          <h2
            id='about-heading'
            className='text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight'
          >
            <span className='gradient-text'>{t('about.title')}</span>
            <br />
            <span className='text-foreground'>{t('about.titleAccent')}</span>
          </h2>

          <div className='mt-6 flex flex-col gap-4 text-muted-foreground text-base leading-relaxed'>
            <p>{t('about.p1')}</p>
            <p>{t('about.p2')}</p>
            <p className='text-foreground font-medium'>{t('about.p3')}</p>
          </div>

          <Link
            href='/journey'
            onClick={() => track('follow_journey_click', { location: 'about' })}
            className='group mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground'
          >
            {t('about.readLog')}
            <ArrowRight
              size={14}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </Link>
        </div>

        {/* Operating principle */}
        <div className='about-col glow-border rounded-3xl bg-card p-8 md:p-10'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground/70 mb-6 font-medium'>
            {t('about.howWeOperate')}
          </p>

          <ol className='principle-list flex flex-col'>
            {principles.map((p, i) => (
              <li
                key={p.title}
                className='principle-step relative flex gap-4 pb-6 last:pb-0'
              >
                {/* Connector */}
                {i < principles.length - 1 && (
                  <span
                    className='absolute left-3 top-7 bottom-0 w-px bg-border'
                    aria-hidden='true'
                  />
                )}
                <span
                  className='relative z-10 shrink-0 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular-nums'
                  aria-hidden='true'
                >
                  {i + 1}
                </span>
                <div className='pt-0.5'>
                  <h3 className='text-sm font-semibold text-foreground'>
                    {t(p.title)}
                  </h3>
                  <p className='text-sm text-muted-foreground leading-relaxed mt-0.5'>
                    {t(p.body)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
