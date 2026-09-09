'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, PlayCircle } from 'lucide-react';
import { track } from '@/lib/analytics';
import type { Project } from '@/lib/projects';
import { demoPath, hasDemo } from '@/lib/demo/registry';
import ProjectVisual from '@/components/ProjectVisual';
import StatusBadge from '@/components/StatusBadge';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * One project in the portfolio grid.
 *
 * ─── Why the whole card is no longer a <Link> ─────────────────────────────
 * It was, and it could not stay that way: a card can now offer two
 * destinations — the project's page and its interactive demo — and a link
 * inside a link is invalid HTML that browsers resolve by dropping one of them.
 *
 * The replacement is the standard pattern rather than an overlay <a> with an
 * aria-label: the card is an <article>, the project link lives inside the
 * heading and stretches itself over the card with a pseudo-element, and the
 * demo link sits above it on the z-axis. That keeps exactly one accessible
 * name for the card-wide target (the project's title, which is what a screen
 * reader should announce), puts the focus ring on the title where it is
 * visible, and leaves the demo link as an ordinary, separately focusable
 * control.
 */

const cardClasses =
  'project-card group relative glow-border rounded-2xl bg-card p-6 flex flex-col gap-4 h-full';

export default function ProjectCard({ project }: { project: Project }) {
  const t = useTranslation();
  const demo = hasDemo(project.slug);

  return (
    <article
      className={
        project.detailed || demo
          ? `${cardClasses} transition-all duration-300 hover:border-foreground/25 hover:bg-accent/30`
          : cardClasses
      }
    >
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
          {project.detailed ? (
            <Link
              href={`/work/${project.slug}`}
              onClick={() =>
                track('project_click', {
                  project: project.slug,
                  status: project.status,
                })
              }
              /* The pseudo-element is what makes the whole card clickable
                 without a second link wrapping one. */
              className='after:absolute after:inset-0 after:content-[""] after:rounded-2xl'
            >
              {project.title}
            </Link>
          ) : (
            project.title
          )}
          {project.detailed && (
            <ArrowUpRight
              size={15}
              aria-hidden='true'
              className='text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-[color,transform] duration-200'
            />
          )}
        </h3>
        <p className='text-sm text-muted-foreground leading-relaxed'>
          {t(('project.' + project.slug + '.description') as TranslationKey)}
        </p>
      </div>

      <div className='flex items-center justify-between gap-3'>
        {project.year ? (
          <span className='text-xs text-muted-foreground/50'>{project.year}</span>
        ) : (
          <span />
        )}

        {/* Above the stretched link, so it is its own target rather than a
            piece of the card. */}
        {demo && (
          <Link
            href={demoPath(project.slug)}
            onClick={() => track('demo_cta_click', { project: project.slug })}
            className='relative z-10 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80 hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-2.5 py-1.5 transition-colors duration-200'
          >
            <PlayCircle size={13} aria-hidden='true' />
            {t('demo.cardCta')}
          </Link>
        )}
      </div>
    </article>
  );
}
