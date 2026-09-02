'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Boxes, Repeat, Unplug, Waypoints } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

const pains: {
  icon: typeof Repeat;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  { icon: Repeat, title: 'pain.manual.title', body: 'pain.manual.body' },
  { icon: Unplug, title: 'pain.tools.title', body: 'pain.tools.body' },
  { icon: Boxes, title: 'pain.software.title', body: 'pain.software.body' },
  { icon: Waypoints, title: 'pain.growth.title', body: 'pain.growth.body' },
];

export default function PainPoints() {
  const t = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pain-card',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 80%',
          },
        },
      );

      gsap.fromTo(
        '.pain-heading',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='problem'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 relative'
    >
      <div className='max-w-5xl mx-auto'>
        {/* Header */}
        <div className='pain-heading text-center mb-16'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            {t('pain.eyebrow')}
          </p>
          <h2 className='text-4xl md:text-5xl font-bold leading-tight gradient-text'>
            {t('pain.title')}
            <br />
            <span className='text-foreground'>{t('pain.titleAccent')}</span>
          </h2>
          <p className='mt-5 text-muted-foreground max-w-xl mx-auto text-base leading-relaxed'>
            {t('pain.body')}
          </p>
        </div>

        {/* Cards */}
        <div ref={cardsRef} className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
          {pains.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className='pain-card glow-border rounded-2xl p-7 bg-card transition-colors duration-300 hover:border-foreground/15 group'
              >
                <div className='w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-5 group-hover:bg-accent transition-colors duration-300'>
                  <Icon
                    size={18}
                    className='text-muted-foreground group-hover:text-foreground transition-colors'
                  />
                </div>
                <h3 className='font-semibold text-foreground text-base mb-2'>
                  {t(p.title)}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {t(p.body)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
