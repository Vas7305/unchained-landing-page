'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';
import type { Project } from '@/lib/projects';
import ProjectVisual from '@/components/ProjectVisual';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';

export default function FlagshipProject({ project }: { project: Project }) {
  const { t, tList } = useLanguage();
  const image = project.thumbnail;
  const size = project.thumbnailSize;
  const interfaceAlt = project.title + ' ' + t('flagship.interfaceAlt');

  return (
    <article className='flagship-card relative overflow-hidden glow-border rounded-3xl bg-card'>
      <div className='grid grid-cols-1 lg:grid-cols-2'>
        {/* Narrative */}
        <div className='p-8 md:p-12 flex flex-col gap-6 order-2 lg:order-1'>
          <div className='flex flex-wrap items-center gap-3'>
            <span className='status-pill border-border text-muted-foreground'>
              {t('flagship.badge')}
            </span>
            <StatusBadge status={project.status} />
          </div>

          <div>
            <h3 className='text-3xl md:text-4xl font-extrabold tracking-tight text-foreground'>
              {project.title}
            </h3>
            <p className='mt-3 text-muted-foreground text-base leading-relaxed max-w-lg'>
              {t(('project.' + project.slug + '.description') as TranslationKey)}
            </p>
          </div>

          {project.capabilities && (
            <div>
              <p className='text-xs uppercase tracking-widest text-muted-foreground/70 mb-3 font-medium'>
                {t('flagship.proves')}
              </p>
              <ul className='flex flex-wrap gap-2'>
                {tList(
                  ('project.' + project.slug + '.capabilities') as ListKey,
                ).map((c) => (
                  <li
                    key={c}
                    className='text-xs text-muted-foreground bg-secondary/70 border border-border rounded-lg px-2.5 py-1.5'
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='flex flex-col sm:flex-row sm:items-center gap-4 pt-1'>
            <Link
              href={`/work/${project.slug}`}
              onClick={() => track('project_click', { project: project.slug })}
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              {t('flagship.view')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
            {project.outcome && (
              <p className='text-xs text-muted-foreground/70 leading-relaxed max-w-xs'>
                {t(('project.' + project.slug + '.outcome') as TranslationKey)}
              </p>
            )}
          </div>
        </div>

        {/* Product shot — right half only */}
        <div className='relative order-1 lg:order-2 min-h-56 lg:min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-l border-border'>
          {image ? (
            <div className='absolute inset-0 p-5 lg:p-8 flex items-center justify-center'>
              {size ? (
                /* Sized to the artwork, not the frame, so the rounded corners
                   land on the screenshot's own edges. */
                <Image
                  src={image}
                  alt={interfaceAlt}
                  width={size.width}
                  height={size.height}
                  sizes='(min-width: 1024px) 50vw, 100vw'
                  className='h-auto w-auto max-h-full max-w-full rounded-xl'
                />
              ) : (
                <div className='relative h-full w-full'>
                  <Image
                    src={image}
                    alt={interfaceAlt}
                    fill
                    sizes='(min-width: 1024px) 50vw, 100vw'
                    className='object-contain object-center'
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className='absolute inset-0 text-foreground opacity-70'>
                <ProjectVisual slug={project.slug} density='full' />
              </div>
              <div
                className='absolute inset-0 pointer-events-none'
                style={{
                  background:
                    'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--card) 100%)',
                  opacity: 0.65,
                }}
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
