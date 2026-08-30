'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FlagshipProject from '@/components/FlagshipProject';
import ProjectCard from '@/components/ProjectCard';
import ScrollDepth from '@/components/ScrollDepth';
import {
  STATUS_META,
  featuredProject,
  otherProjects,
  projects,
  type ProjectStatus,
} from '@/lib/projects';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

const statusOrder: ProjectStatus[] = [
  'completed',
  'in-development',
  'concept',
  'internal',
  'dismissed',
];

export default function WorkPageView() {
  const t = useTranslation();
  const legend = statusOrder.filter((status) =>
    projects.some((p) => p.status === status),
  );

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page='work' />

      <PageHeader
        eyebrow={t('workPage.eyebrow')}
        title={t('work.title')}
        accent={t('work.titleAccent')}
        lede={t('workPage.lede')}
      />

      {/* Status legend — the statuses do real work, so we explain them */}
      <section className='px-6 pb-4' aria-label={t('workPage.statusKey')}>
        <div className='max-w-5xl mx-auto flex flex-wrap gap-x-6 gap-y-3'>
          {legend.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div key={status} className='flex items-center gap-2'>
                <span className={`status-pill ${meta.className}`}>
                  <span className='status-dot' aria-hidden='true' />
                  {t(('status.' + status + '.label') as TranslationKey)}
                </span>
                <span className='text-xs text-muted-foreground'>
                  {t(('status.' + status + '.description') as TranslationKey)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className='px-6 py-12' aria-label={t('workPage.projects')}>
        <div className='max-w-6xl mx-auto'>
          {featuredProject && <FlagshipProject project={featuredProject} />}

          <div className='mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
            {otherProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </div>
      </section>

      {/* Honest closing note */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-6xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8 justify-between'>
          <div className='max-w-xl'>
            <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
              {t('workPage.provesTitle')}
            </h2>
            <p className='mt-4 text-muted-foreground leading-relaxed'>
              {t('workPage.provesBody')}
            </p>
          </div>
          <div className='flex flex-col sm:flex-row md:flex-col gap-3 shrink-0'>
            <Link
              href='/#contact'
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              {t('nav.startProject')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
            <Link
              href='/journey'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200'
            >
              {t('common.followTheJourney')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
