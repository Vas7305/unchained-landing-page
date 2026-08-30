'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';

gsap.registerPlugin(ScrollTrigger);

/** `id` is the stable analytics label — it must not move with the language. */
const engagements: {
  id: string;
  tag: TranslationKey;
  title: TranslationKey;
  description: TranslationKey;
  features: ListKey;
  featured?: boolean;
}[] = [
  {
    id: 'discovery',
    tag: 'svc.discovery.tag',
    title: 'svc.discovery.title',
    description: 'svc.discovery.description',
    features: 'svc.discovery.features',
  },
  {
    id: 'build',
    tag: 'svc.build.tag',
    title: 'svc.build.title',
    description: 'svc.build.description',
    features: 'svc.build.features',
    featured: true,
  },
  {
    id: 'growth',
    tag: 'svc.growth.tag',
    title: 'svc.growth.title',
    description: 'svc.growth.description',
    features: 'svc.growth.features',
  },
];

export default function Services() {
  const { t, tList } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.service-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='engagements'
      ref={sectionRef}
      className='py-24 md:py-28 px-6'
      aria-labelledby='engagements-heading'
    >
      <div className='max-w-5xl mx-auto'>
        <div className='text-center mb-16'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            {t('svc.eyebrow')}
          </p>
          <h2
            id='engagements-heading'
            className='text-4xl md:text-5xl font-bold leading-tight gradient-text'
          >
            {t('svc.title')}
            <br />
            <span className='text-foreground'>{t('svc.titleAccent')}</span>
          </h2>
          <p className='mt-5 text-muted-foreground max-w-lg mx-auto text-base leading-relaxed'>
            {t('svc.body')}
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-start'>
          {engagements.map((s) => (
            <div
              key={s.id}
              className={`service-card relative rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300
                ${
                  s.featured
                    ? 'bg-foreground text-background border border-foreground'
                    : 'bg-card glow-border hover:border-foreground/20'
                }
              `}
            >
              {s.featured && (
                <div className='absolute -top-3 left-1/2 -translate-x-1/2 bg-background text-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-border whitespace-nowrap'>
                  {t('svc.coreBuild')}
                </div>
              )}

              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                    s.featured
                      ? 'bg-background/15 text-background/80'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {t(s.tag)}
                </span>
              </div>

              <div>
                <h3
                  className={`text-xl font-bold mb-1 ${s.featured ? 'text-background' : 'text-foreground'}`}
                >
                  {t(s.title)}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${s.featured ? 'text-background/70' : 'text-muted-foreground'}`}
                >
                  {t(s.description)}
                </p>
              </div>

              <ul className='flex flex-col gap-2.5 flex-1'>
                {tList(s.features).map((f) => (
                  <li key={f} className='flex items-start gap-2.5 text-sm'>
                    <CheckCircle2
                      size={15}
                      aria-hidden='true'
                      className={`mt-0.5 shrink-0 ${s.featured ? 'text-background/60' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={
                        s.featured
                          ? 'text-background/80'
                          : 'text-muted-foreground'
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href='#contact'
                onClick={() =>
                  track('start_project_click', {
                    location: 'engagements',
                    engagement: s.id,
                  })
                }
                className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm py-3 px-5 transition-all duration-200 group
                  ${
                    s.featured
                      ? 'bg-background text-foreground hover:bg-background/90'
                      : 'bg-secondary hover:bg-accent text-foreground'
                  }`}
              >
                {t('nav.startProject')}
                <ArrowRight
                  size={14}
                  aria-hidden='true'
                  className='group-hover:translate-x-1 transition-transform duration-200'
                />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
