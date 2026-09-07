'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import FlagshipProject from '@/components/FlagshipProject';
import ProjectCard from '@/components/ProjectCard';
import { track } from '@/lib/analytics';
import type { Project } from '@/lib/projects';
import { useTranslation } from '@/lib/i18n/LanguageProvider';

gsap.registerPlugin(ScrollTrigger);

/**
 * The homepage's Our Work section.
 *
 * The portfolio arrives as props rather than being imported. It used to be two
 * module constants computed from lib/projects.ts at import time; it is now a
 * database answer, and a client component cannot await one. app/page.tsx reads
 * it while the page is prerendered and hands the result down, which keeps this
 * section in the static HTML exactly as it was — the animation below is the
 * only reason this file is a client component at all.
 */
export default function Work({
  featured,
  others,
}: {
  featured: Project | undefined;
  others: Project[];
}) {
  const t = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.flagship-card',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.flagship-card', start: 'top 85%' },
        },
      );

      gsap.fromTo(
        '.project-card',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.project-grid', start: 'top 85%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='work'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 bg-secondary/20'
      aria-labelledby='work-heading'
    >
      <div className='max-w-6xl mx-auto'>
        <SectionHeading
          eyebrow={t('work.eyebrow')}
          title={t('work.title')}
          accent={t('work.titleAccent')}
          titleId='work-heading'
          body={t('work.body')}
        />

        {featured && (
          <div className='mt-16'>
            <FlagshipProject project={featured} />
          </div>
        )}

        <div className='project-grid mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
          {others.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>

        <div className='mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 text-center'>
          <Link
            href='/work'
            onClick={() => track('explore_work_click', { location: 'work' })}
            className='group inline-flex items-center gap-2 glow-border bg-card hover:border-foreground/25 text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-colors duration-200'
          >
            {t('work.exploreAll')}
            <ArrowRight
              size={15}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </Link>
          <p className='text-xs text-muted-foreground/70 max-w-xs sm:text-left'>
            {t('work.note')}
          </p>
        </div>
      </div>
    </section>
  );
}
