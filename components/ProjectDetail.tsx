'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, ExternalLink, PlayCircle } from 'lucide-react';
import { track } from '@/lib/analytics';
import { demoPath, hasDemo } from '@/lib/demo/registry';
import ProjectVisual from '@/components/ProjectVisual';
import ProjectViewTracker from '@/components/ProjectViewTracker';
import ScrollDepth from '@/components/ScrollDepth';
import StatusBadge from '@/components/StatusBadge';
import type { Project } from '@/lib/projects';
import StartProjectButton from '@/components/StartProjectButton';
import { useLanguage, useTranslation } from '@/lib/i18n/LanguageProvider';
import {
  useProjectCopy,
  type ResolvedProjectCopy,
} from '@/lib/cms/projectCopy';

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col gap-1 py-3 border-b border-border last:border-0'>
      <dt className='text-xs uppercase tracking-widest text-muted-foreground/60'>
        {label}
      </dt>
      <dd className='text-sm text-foreground'>{value}</dd>
    </div>
  );
}

/**
 * The two things a visitor can do with a project from its hero.
 *
 * Its own component because the pair is conditional in three ways — a demo, a
 * live product, both, or neither — and folding that into the page component
 * put four more branches into a function that already renders six sections.
 *
 * §15: the two destinations are deliberately distinguishable. The demo is the
 * filled, primary action, because it is exploration that stays on this site and
 * needs no account; the live product is the real thing and is marked as
 * leaving. A project with neither renders neither.
 */
function HeroActions({ project }: { project: Project }) {
  const t = useTranslation();
  const demo = hasDemo(project.slug);

  if (!demo && !project.externalUrl) return null;

  return (
    <div className='mt-8 flex flex-col sm:flex-row gap-3'>
      {demo && (
        <Link
          href={demoPath(project.slug)}
          onClick={() => track('demo_cta_click', { project: project.slug })}
          className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
        >
          <PlayCircle size={15} aria-hidden='true' />
          {t('demo.cta')}
          <ArrowRight
            size={14}
            aria-hidden='true'
            className='group-hover:translate-x-1 transition-transform duration-200'
          />
        </Link>
      )}

      {project.externalUrl && (
        <a
          href={project.externalUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-colors duration-200'
        >
          {t('detail.visitLive')}
          <ExternalLink size={14} aria-hidden='true' />
        </a>
      )}
    </div>
  );
}

/**
 * The picture at the top of a detail page, and what it should be announced as.
 *
 * ─── Why this is a function and not four lines in the component ───────────
 * It pairs two decisions that have to agree, and getting them out of the
 * render is what keeps them agreeing: WHICH image is shown, and WHOSE alt text
 * describes it. Written inline, the second is easy to update without the
 * first — and the failure mode is a screen reader describing the card shot
 * while the page displays the hero.
 *
 * The alt chain is: what an editor wrote for THIS image, in this place; then a
 * sentence assembled from the title. An editor's description of the actual
 * screenshot always beats a generated one, and there is always one of the two,
 * so the image is never announced as nothing.
 */
function detailBandImage(
  project: Project,
  copy: ResolvedProjectCopy,
  fallbackSuffix: string,
): { src: string | undefined; alt: string } {
  // Detail pages prefer a dedicated hero image, falling back to the card shot.
  const usingHero = Boolean(project.heroImage);
  const src = project.heroImage ?? project.thumbnail;
  const written = usingHero ? copy.heroImageAlt : copy.thumbnailAlt;

  return { src, alt: written ?? `${copy.title} ${fallbackSuffix}` };
}

export default function ProjectDetail({ project }: { project: Project }) {
  const { t } = useLanguage();

  /**
   * Every prose field, resolved in the visitor's language.
   *
   * This used to read the dictionary directly under `project.<slug>.<field>`
   * keys. It cannot any more: a project created in the panel has no such keys,
   * and `t()` returns the key itself on a miss — so an editor's new project
   * would have printed "project.acme-corp.challenge" on the page. The chain in
   * useProjectCopy keeps the existing six-language copy for the projects that
   * have it, and reads the CMS for everything else.
   */
  const copy = useProjectCopy(project);

  const { src: bandImage, alt: interfaceAlt } = detailBandImage(
    project,
    copy,
    t('flagship.interfaceAlt'),
  );
  const lede = copy.summary ?? copy.description;

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page={`work/${project.slug}`} />
      <ProjectViewTracker slug={project.slug} />

      {/* Hero */}
      <section className='relative overflow-hidden px-6 pt-32 pb-16 md:pt-40'>
        <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

        <div className='relative max-w-5xl mx-auto'>
          <Link
            href='/work'
            className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
          >
            <ArrowLeft size={14} aria-hidden='true' />
            {t('detail.allWork')}
          </Link>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            {project.featured && (
              <span className='status-pill border-border text-muted-foreground'>
                {t('flagship.badge')}
              </span>
            )}
            <StatusBadge status={project.status} />
            <span className='text-xs uppercase tracking-widest text-muted-foreground'>
              {copy.category}
            </span>
          </div>

          <h1 className='mt-6 text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02] gradient-text'>
            {copy.title}
          </h1>

          <p className='mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed'>
            {lede}
          </p>

          <HeroActions project={project} />
        </div>
      </section>

      {/* Visual band */}
      <section className='px-6' aria-hidden={bandImage ? undefined : true}>
        <div className='max-w-5xl mx-auto h-72 md:h-[26rem] rounded-3xl glow-border bg-card overflow-hidden relative'>
          {bandImage ? (
            <Image
              src={bandImage}
              alt={interfaceAlt}
              fill
              sizes='(min-width: 1024px) 1024px, 100vw'
              priority
              className='object-cover object-top'
            />
          ) : (
            <>
              <div className='absolute inset-0 text-foreground opacity-70'>
                <ProjectVisual slug={project.slug} density='full' />
              </div>
              <div
                className='absolute inset-0'
                style={{
                  background:
                    'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, var(--card) 100%)',
                  opacity: 0.6,
                }}
              />
            </>
          )}
        </div>
      </section>

      {/* Body */}
      <section className='px-6 py-16 md:py-24'>
        <div className='max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 lg:gap-16 items-start'>
          {/* Narrative */}
          <div className='flex flex-col gap-12'>
            {copy.challenge && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4'>
                  {t('detail.challenge')}
                </h2>
                <p className='text-muted-foreground text-base leading-relaxed'>
                  {copy.challenge}
                </p>
              </div>
            )}

            {copy.solution && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4'>
                  {t('detail.whatWeBuilt')}
                </h2>
                <p className='text-muted-foreground text-base leading-relaxed'>
                  {copy.solution}
                </p>
              </div>
            )}

            {copy.capabilities && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2'>
                  {t('detail.proves')}
                </h2>
                <p className='text-sm text-muted-foreground mb-6 max-w-xl leading-relaxed'>
                  {t('detail.provesNote')}
                </p>
                <ul className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {copy.capabilities.map((c) => (
                    <li
                      key={c}
                      className='glow-border rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground'
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {copy.outcome && (
              <div className='glow-border rounded-2xl bg-card p-8'>
                <h2 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-3'>
                  {t('detail.outcome')}
                </h2>
                <p className='text-lg font-medium text-foreground leading-snug'>
                  {copy.outcome}
                </p>
              </div>
            )}
          </div>

          {/* Fact panel */}
          <aside className='glow-border rounded-2xl bg-card p-6 lg:sticky lg:top-28'>
            <h2 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-2'>
              {t('detail.details')}
            </h2>
            <dl>
              {project.year && (
                <Meta label={t('detail.year')} value={project.year} />
              )}
              {copy.industry && (
                <Meta label={t('detail.industry')} value={copy.industry} />
              )}
              {copy.services && (
                <Meta
                  label={t('detail.services')}
                  value={copy.services.join(', ')}
                />
              )}
              {/* Technology names are usually the same in every language, and
                  have never had a dictionary entry. They go through the same
                  resolver all the same, so a translation entered in the panel
                  — a script change, say — is honoured rather than ignored. */}
              {copy.technologies && (
                <Meta
                  label={t('detail.stack')}
                  value={copy.technologies.join(', ')}
                />
              )}
            </dl>
          </aside>
        </div>
      </section>

      {/* Next step */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-5xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 text-center flex flex-col items-center gap-6'>
          <h2 className='text-2xl md:text-4xl font-bold tracking-tight'>
            <span className='gradient-text'>{t('detail.ctaTitle')}</span>{' '}
            <span className='text-foreground'>{t('detail.ctaAccent')}</span>
          </h2>
          <p className='text-muted-foreground max-w-xl leading-relaxed'>
            {t('detail.ctaBody')}
          </p>
          <div className='flex flex-col sm:flex-row gap-3'>
            <StartProjectButton
              source='project'
              detail={project.slug}
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
            >
              {t('nav.startProject')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </StartProjectButton>
            <Link
              href='/work'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors duration-200'
            >
              {t('detail.seeRest')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
