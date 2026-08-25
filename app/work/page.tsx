import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Our Work',
  description:
    'The products, websites and systems Unchained Business is building — including TanCerca, our first completed flagship product, and five projects currently in development.',
  alternates: { canonical: '/work' },
};

const statusOrder: ProjectStatus[] = [
  'completed',
  'in-development',
  'concept',
  'internal',
];

export default function WorkPage() {
  const legend = statusOrder.filter((status) =>
    projects.some((p) => p.status === status),
  );

  return (
    <main id='main' className='min-h-screen'>
      <ScrollDepth page='work' />

      <PageHeader
        eyebrow='Portfolio'
        title='Our Work'
        accent='Is Our Proof.'
        lede="We're building Unchained Business one project at a time. Everything below is shown at its real stage — shipped, in development, or still a concept. Nothing here is a client engagement dressed up as something else."
      />

      {/* Status legend — the statuses do real work, so we explain them */}
      <section className='px-6 pb-4' aria-label='Project status key'>
        <div className='max-w-5xl mx-auto flex flex-wrap gap-x-6 gap-y-3'>
          {legend.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div key={status} className='flex items-center gap-2'>
                <span className={`status-pill ${meta.className}`}>
                  <span className='status-dot' aria-hidden='true' />
                  {meta.label}
                </span>
                <span className='text-xs text-muted-foreground'>
                  {meta.description}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className='px-6 py-12' aria-label='Projects'>
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
              What this portfolio proves — and what it doesn&apos;t.
            </h2>
            <p className='mt-4 text-muted-foreground leading-relaxed'>
              These projects demonstrate that we can architect and build
              complex, production-grade systems end to end. They do not yet
              demonstrate large-scale commercial results for clients, and we
              won&apos;t pretend otherwise. That evidence is what we&apos;re
              building next — publicly, in our journey log.
            </p>
          </div>
          <div className='flex flex-col sm:flex-row md:flex-col gap-3 shrink-0'>
            <Link
              href='/#contact'
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              Start a Project
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
              Follow the Journey
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
