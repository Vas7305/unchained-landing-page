'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { track } from '@/lib/analytics';
import type { Project } from '@/lib/projects';
import ProjectVisual from '@/components/ProjectVisual';
import StatusBadge from '@/components/StatusBadge';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

function CardBody({ project }: { project: Project }) {
  const t = useTranslation();

  return (
    <>
      {/* Fixed two-line height: a category that wraps must not push the
          thumbnail down, or cards sit at different heights in the same row. */}
      <div className='flex items-start justify-between gap-4 min-h-8'>
        <span className='text-xs uppercase tracking-widest text-muted-foreground'>
          {t(('project.' + project.slug + '.category') as TranslationKey)}
        </span>
        <StatusBadge status={project.status} />
      </div>

      <div className='relative h-28 -mx-1 my-1 text-foreground overflow-hidden rounded-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500'>
        {project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt=''
            fill
            sizes='(min-width: 768px) 33vw, 100vw'
            className='object-cover object-top'
          />
        ) : (
          <ProjectVisual slug={project.slug} />
        )}
      </div>

      <div className='flex-1'>
        <h3 className='text-lg font-semibold text-foreground mb-2 flex items-center gap-1.5'>
          {project.title}
          {project.detailed && (
            <ArrowUpRight
              size={15}
              aria-hidden='true'
              className='text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200'
            />
          )}
        </h3>
        <p className='text-sm text-muted-foreground leading-relaxed'>
          {t(('project.' + project.slug + '.description') as TranslationKey)}
        </p>
      </div>

      {project.year && (
        <span className='text-xs text-muted-foreground/50'>{project.year}</span>
      )}
    </>
  );
}

const cardClasses =
  'project-card group glow-border rounded-2xl bg-card p-6 flex flex-col gap-4 h-full';

export default function ProjectCard({ project }: { project: Project }) {
  if (!project.detailed) {
    return (
      <article className={cardClasses}>
        <CardBody project={project} />
      </article>
    );
  }

  return (
    <Link
      href={`/work/${project.slug}`}
      onClick={() =>
        track('project_click', {
          project: project.slug,
          status: project.status,
        })
      }
      className={`${cardClasses} hover:border-foreground/25 hover:bg-accent/30 transition-all duration-300`}
    >
      <CardBody project={project} />
    </Link>
  );
}
