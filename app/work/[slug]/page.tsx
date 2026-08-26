import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import ProjectVisual from '@/components/ProjectVisual';
import ProjectViewTracker from '@/components/ProjectViewTracker';
import ScrollDepth from '@/components/ScrollDepth';
import StatusBadge from '@/components/StatusBadge';
import { detailedProjects, getProject } from '@/lib/projects';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return detailedProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) return { title: 'Project not found' };

  return {
    title: project.title,
    description: project.summary ?? project.description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.title} — Unchained Business`,
      description: project.summary ?? project.description,
      type: 'article',
    },
  };
}

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

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) notFound();

  // Detail pages prefer a dedicated hero image, falling back to the card shot.
  const bandImage = project.heroImage ?? project.thumbnail;

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
            All work
          </Link>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            {project.featured && (
              <span className='status-pill border-border text-muted-foreground'>
                Flagship Product
              </span>
            )}
            <StatusBadge status={project.status} />
            <span className='text-xs uppercase tracking-widest text-muted-foreground'>
              {project.category}
            </span>
          </div>

          <h1 className='mt-6 text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.02] gradient-text'>
            {project.title}
          </h1>

          <p className='mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed'>
            {project.summary ?? project.description}
          </p>

          {project.externalUrl && (
            <a
              href={project.externalUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='group mt-8 inline-flex items-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              Visit the live product
              <ExternalLink size={14} aria-hidden='true' />
            </a>
          )}
        </div>
      </section>

      {/* Visual band */}
      <section className='px-6' aria-hidden={bandImage ? undefined : true}>
        <div className='max-w-5xl mx-auto h-72 md:h-[26rem] rounded-3xl glow-border bg-card overflow-hidden relative'>
          {bandImage ? (
            <Image
              src={bandImage}
              alt={project.title + ' product interface'}
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
            {project.challenge && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4'>
                  The challenge
                </h2>
                <p className='text-muted-foreground text-base leading-relaxed'>
                  {project.challenge}
                </p>
              </div>
            )}

            {project.solution && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4'>
                  What we built
                </h2>
                <p className='text-muted-foreground text-base leading-relaxed'>
                  {project.solution}
                </p>
              </div>
            )}

            {project.capabilities && (
              <div>
                <h2 className='text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2'>
                  What it proves
                </h2>
                <p className='text-sm text-muted-foreground mb-6 max-w-xl leading-relaxed'>
                  We report capability, not invented business results. These are
                  the systems this project required us to design, build and
                  operate.
                </p>
                <ul className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {project.capabilities.map((c) => (
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

            {project.outcome && (
              <div className='glow-border rounded-2xl bg-card p-8'>
                <h2 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-3'>
                  Outcome
                </h2>
                <p className='text-lg font-medium text-foreground leading-snug'>
                  {project.outcome}
                </p>
              </div>
            )}
          </div>

          {/* Fact panel */}
          <aside className='glow-border rounded-2xl bg-card p-6 lg:sticky lg:top-28'>
            <h2 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-2'>
              Project details
            </h2>
            <dl>
              {project.year && <Meta label='Year' value={project.year} />}
              {project.industry && (
                <Meta label='Industry' value={project.industry} />
              )}
              {project.services && (
                <Meta label='Services' value={project.services.join(', ')} />
              )}
              {project.technologies && (
                <Meta label='Stack' value={project.technologies.join(', ')} />
              )}
            </dl>
          </aside>
        </div>
      </section>

      {/* Next step */}
      <section className='px-6 pb-24 md:pb-28'>
        <div className='max-w-5xl mx-auto glow-border rounded-3xl bg-card p-8 md:p-12 text-center flex flex-col items-center gap-6'>
          <h2 className='text-2xl md:text-4xl font-bold tracking-tight'>
            <span className='gradient-text'>Want something like this</span>{' '}
            <span className='text-foreground'>built for your business?</span>
          </h2>
          <p className='text-muted-foreground max-w-xl leading-relaxed'>
            Same process, same standards, applied to your problem — starting
            with a fixed-scope discovery and architecture engagement.
          </p>
          <div className='flex flex-col sm:flex-row gap-3'>
            <Link
              href='/#contact'
              className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
            >
              Start a Project
              <ArrowRight
                size={15}
                aria-hidden='true'
                className='group-hover:translate-x-1 transition-transform duration-200'
              />
            </Link>
            <Link
              href='/work'
              className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3.5 rounded-xl text-sm transition-all duration-200'
            >
              See the rest of our work
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
