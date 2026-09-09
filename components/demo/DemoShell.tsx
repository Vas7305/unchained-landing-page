'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import StartProjectButton from '@/components/StartProjectButton';
import ScrollDepth from '@/components/ScrollDepth';
import DemoFrame from './DemoFrame';
import DemoStage from './DemoStage';
import { track } from '@/lib/analytics';
import { getDemo, resolveScenario } from '@/lib/demo/registry';
import type { DemoDefinition } from '@/lib/demo/types';
import type { Project } from '@/lib/projects';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

/**
 * The website's half of a demo page.
 *
 * ─── The boundary this component draws ────────────────────────────────────
 * Everything here is Unchained Business: the site's typography, the site's
 * palette, the project's real published copy, and the way back to the rest of
 * the portfolio. Everything inside <DemoFrame> is the product. The visitor
 * should never be in doubt about which of the two they are looking at, and
 * should never have to leave the site to find out what the product does (§14).
 *
 * ─── Server-rendered, on purpose ──────────────────────────────────────────
 * This is a client component for its two pieces of state, but it renders
 * during the server pass like any other, so the heading, the explanation, the
 * project's description and every link are in the HTML. The interactive demo
 * inside is the only client-only part (see DemoStage). A crawler, a visitor
 * with JavaScript disabled and a slow connection all get a complete, sensible
 * page describing the product.
 *
 * ─── The two controls, and why there are only two ─────────────────────────
 * §10 asks for a lightweight control mechanism and warns against exposing
 * developer surface to visitors. So: a scenario picker, rendered only when the
 * demo actually has more than one story to tell, and a reset. There is no
 * state inspector, no latency slider and no seed box — those would be debug
 * controls wearing a product's clothes.
 */

/**
 * The demo definition is looked up here rather than handed down from the route.
 *
 * It has to be. A `DemoDefinition` carries `load`, a function, and functions
 * cannot cross the server-to-client boundary — passing one from the route's
 * server component fails the build with "Functions cannot be passed directly
 * to Client Components". The route therefore passes the project, which is
 * plain data, and this side resolves the rest from the registry it already
 * imports.
 */
export default function DemoShell({ project }: { project: Project }) {
  const definition = getDemo(project.slug);

  // Unreachable: app/work/[slug]/demo/page.tsx calls notFound() unless the
  // registry has an entry for this slug. Narrowing rather than asserting, so a
  // future caller that skips that check renders nothing instead of throwing.
  if (!definition) return null;

  return <Shell project={project} definition={definition} />;
}

function Shell({
  project,
  definition,
}: {
  project: Project;
  definition: DemoDefinition;
}) {
  const { t } = useLanguage();

  const [scenarioId, setScenarioId] = useState(() =>
    resolveScenario(definition),
  );
  /** Bumping this remounts the demo, which is what reset means here. */
  const [resetToken, setResetToken] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // §25: the slug and nothing else. No scenario content, no interaction
    // detail, nothing the visitor typed — the site already tracks a project
    // view exactly this way.
    track('demo_open', { project: project.slug });
  }, [project.slug]);

  const reset = useCallback(() => {
    setResetToken((token) => token + 1);
    setAnnouncement(t('demo.resetDone'));
    track('demo_reset', { project: project.slug });
  }, [project.slug, t]);

  const scenarios = definition.scenarios;
  const activeScenario =
    scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  function chooseScenario(id: string) {
    setScenarioId(id);
    // A scenario is a different starting position, so it starts fresh — the
    // same guarantee reset gives, for the same reason.
    setResetToken((token) => token + 1);
  }

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page={`work/${project.slug}/demo`} />

      <section className='relative px-6 pt-32 pb-10 md:pt-36'>
        <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

        <div className='relative max-w-6xl mx-auto'>
          <Link
            href={`/work/${project.slug}`}
            className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
          >
            <ArrowLeft size={14} aria-hidden='true' />
            {t('demo.backToProject')}
          </Link>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <span className='status-pill border-foreground/25 text-foreground'>
              <span className='status-dot' aria-hidden='true' />
              {t('demo.eyebrow')}
            </span>
            <StatusBadge status={project.status} />
            <span className='text-xs uppercase tracking-widest text-muted-foreground'>
              {t(('project.' + project.slug + '.category') as TranslationKey)}
            </span>
          </div>

          <h1 className='mt-6 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] gradient-text'>
            {project.title}
          </h1>

          <p className='mt-5 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed'>
            {t('demo.lede')}
          </p>

          {/* §9: stated plainly, sized so it informs without dominating. */}
          <p className='mt-4 max-w-2xl text-sm text-muted-foreground/80 leading-relaxed glow-border rounded-xl bg-card/60 px-4 py-3'>
            {t('demo.disclaimer')}
          </p>
        </div>
      </section>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <section className='px-6'>
        <div className='max-w-6xl mx-auto flex flex-wrap items-end gap-x-6 gap-y-4 justify-between'>
          <div
            className='flex flex-wrap items-end gap-4'
            role='group'
            aria-label={t('demo.controlsLabel')}
          >
            {scenarios.length > 1 && (
              <div className='flex flex-col gap-1.5'>
                <label
                  htmlFor='demo-scenario'
                  className='text-xs uppercase tracking-widest text-muted-foreground/60'
                >
                  {t('demo.scenario')}
                </label>
                <select
                  id='demo-scenario'
                  value={scenarioId}
                  onChange={(event) => chooseScenario(event.target.value)}
                  className='glow-border rounded-xl bg-secondary text-foreground text-sm font-medium px-3 min-h-11 pr-8'
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type='button'
              onClick={reset}
              className='inline-flex items-center gap-2 glow-border rounded-xl bg-secondary hover:bg-accent text-foreground font-semibold px-4 min-h-11 text-sm transition-colors duration-200'
            >
              <RotateCcw size={14} aria-hidden='true' />
              {t('demo.reset')}
            </button>
          </div>

          <p className='text-xs text-muted-foreground/70 max-w-sm leading-relaxed'>
            {activeScenario.hint ?? t('demo.langNote')}
          </p>
        </div>

        {/* Mounted empty and updated later: a live region inserted at the same
            moment as its text is routinely missed by screen readers. */}
        <p role='status' aria-live='polite' className='sr-only'>
          {announcement}
        </p>
      </section>

      {/* ── The product ──────────────────────────────────────────────────── */}
      <section className='px-6 pt-6 pb-14'>
        <div className='max-w-6xl mx-auto'>
          <DemoFrame
            definition={definition}
            label={`${project.title} — ${t('demo.eyebrow')}`}
          >
            <DemoStage
              key={`${activeScenario.id}:${resetToken}`}
              slug={project.slug}
              scenarioId={activeScenario.id}
              labels={{
                loading: t('demo.loading'),
                error: t('demo.loadError'),
                retry: t('demo.retry'),
              }}
            />
          </DemoFrame>
        </div>
      </section>

      {/* ── Where to go next ─────────────────────────────────────────────── */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-6xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8 justify-between'>
          <div className='max-w-xl'>
            <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
              {t('demo.nextTitle')}
            </h2>
            <p className='mt-3 text-muted-foreground leading-relaxed'>
              {t('demo.nextBody')}
            </p>
          </div>

          <div className='flex flex-col sm:flex-row md:flex-col gap-3 shrink-0'>
            <StartProjectButton
              source='project'
              detail={project.slug}
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-colors duration-200'
            >
              {t('nav.startProject')}
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </StartProjectButton>

            <Link
              href={`/work/${project.slug}`}
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-colors duration-200'
            >
              {t('demo.backToProject')}
            </Link>

            {/* §14/§15: production is still one click away, and it is clearly
                a different destination from the demo. */}
            {project.externalUrl && (
              <a
                href={project.externalUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground px-6 py-3 transition-colors duration-200'
              >
                {t('detail.visitLive')}
                <ExternalLink size={14} aria-hidden='true' />
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
