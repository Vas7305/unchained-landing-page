'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Code2, Workflow, Target } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { pillars } from '@/lib/site';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

const icons = {
  'software-development': Code2,
  'business-automation': Workflow,
  'growth-systems': Target,
} as const;

export default function Capabilities() {
  const { t, tList } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pillar-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='what-we-build'
      ref={sectionRef}
      className='py-24 md:py-28 px-6'
      aria-labelledby='what-we-build-heading'
    >
      <div className='max-w-5xl mx-auto'>
        <SectionHeading
          eyebrow={t('cap.eyebrow')}
          title={t('cap.title')}
          titleId='what-we-build-heading'
          body={t('cap.body')}
        />

        <div className='mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch'>
          {pillars.map((pillar) => {
            const Icon = icons[pillar.slug];
            return (
              <Link
                key={pillar.slug}
                href={`/${pillar.slug}`}
                className='pillar-card group glow-border rounded-2xl bg-card p-8 flex flex-col gap-6 hover:border-foreground/25 hover:bg-accent/25 transition-all duration-300'
              >
                <div className='flex items-center justify-between'>
                  <div className='w-11 h-11 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-accent transition-colors duration-300'>
                    <Icon
                      size={19}
                      aria-hidden='true'
                      className='text-muted-foreground group-hover:text-foreground transition-colors'
                    />
                  </div>
                  <span className='text-xs font-bold tracking-widest text-muted-foreground/40 tabular-nums'>
                    {pillar.number}
                  </span>
                </div>

                <div>
                  <h3 className='text-xl font-semibold text-foreground mb-2'>
                    {t(('pillar.' + pillar.slug) as TranslationKey)}
                  </h3>
                  <p className='text-sm text-muted-foreground leading-relaxed'>
                    {t(('pillarSummary.' + pillar.slug) as TranslationKey)}
                  </p>
                </div>

                <ul className='flex flex-col gap-2 flex-1 border-t border-border pt-5'>
                  {tList(('pillarItems.' + pillar.slug) as ListKey).map((item) => (
                    <li
                      key={item}
                      className='text-sm text-muted-foreground flex items-center gap-2.5'
                    >
                      <span
                        className='w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0'
                        aria-hidden='true'
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <span className='inline-flex items-center gap-1.5 text-sm font-medium text-foreground'>
                  {t('cap.learnMore')}
                  <ArrowRight
                    size={14}
                    aria-hidden='true'
                    className='group-hover:translate-x-1 transition-transform duration-200'
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
