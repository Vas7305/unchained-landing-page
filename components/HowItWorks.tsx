'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Search,
  DraftingCompass,
  Hammer,
  Rocket,
  LineChart,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

const steps: {
  number: string;
  icon: typeof Search;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  {
    number: '01',
    icon: Search,
    title: 'how.discover.title',
    body: 'how.discover.body',
  },
  {
    number: '02',
    icon: DraftingCompass,
    title: 'how.architect.title',
    body: 'how.architect.body',
  },
  {
    number: '03',
    icon: Hammer,
    title: 'how.build.title',
    body: 'how.build.body',
  },
  {
    number: '04',
    icon: Rocket,
    title: 'how.launch.title',
    body: 'how.launch.body',
  },
  {
    number: '05',
    icon: LineChart,
    title: 'how.optimize.title',
    body: 'how.optimize.body',
  },
];

export default function HowItWorks() {
  const t = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.step-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
          },
        },
      );

      gsap.fromTo(
        lineRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 1.2,
          ease: 'power2.inOut',
          transformOrigin: 'top center',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='how-we-work'
      ref={sectionRef}
      className='py-24 md:py-28 px-6'
      aria-labelledby='how-we-work-heading'
    >
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-20'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            {t('how.eyebrow')}
          </p>
          <h2
            id='how-we-work-heading'
            className='text-4xl md:text-5xl font-bold leading-tight'
          >
            <span className='gradient-text'>{t('how.title')}</span>
          </h2>
          <p className='mt-5 text-muted-foreground max-w-lg mx-auto text-base leading-relaxed'>
            {t('how.body')}
          </p>
        </div>

        {/* Steps */}
        <div className='relative'>
          {/* Connecting Line */}
          <div className='hidden md:block absolute left-9.75 top-16 bottom-16 w-px overflow-hidden'>
            <div
              ref={lineRef}
              className='w-full h-full bg-linear-to-b from-foreground/20 via-foreground/10 to-transparent'
            />
          </div>

          <div className='flex flex-col gap-12'>
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className='step-card flex flex-col md:flex-row items-start gap-6 group'
                >
                  {/* Icon circle */}
                  <div className='relative shrink-0'>
                    <div className='w-20 h-20 rounded-2xl bg-secondary glow-border flex items-center justify-center group-hover:bg-accent transition-all duration-300'>
                      <Icon
                        size={26}
                        className='text-muted-foreground group-hover:text-foreground transition-colors'
                      />
                    </div>
                    <span className='absolute -top-2 -right-2 text-[10px] font-bold text-muted-foreground/60 bg-background border border-border rounded-full w-6 h-6 flex items-center justify-center'>
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <div className='pt-2 md:pt-4'>
                    <h3 className='text-xl font-semibold text-foreground mb-2'>
                      {t(step.title)}
                    </h3>
                    <p className='text-muted-foreground text-sm leading-relaxed max-w-lg'>
                      {t(step.body)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
