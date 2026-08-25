'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { JourneyEntry } from '@/lib/journey';

gsap.registerPlugin(ScrollTrigger);

const blocks = [
  { key: 'happened', label: 'What Happened' },
  { key: 'learned', label: 'What We Learned' },
  { key: 'changed', label: 'What Changed' },
] as const;

function EntryCard({ entry }: { entry: JourneyEntry }) {
  return (
    <article
      id={entry.id}
      className='journey-entry relative pl-8 md:pl-14 pb-16 last:pb-0 scroll-mt-28'
    >
      {/* Rail node */}
      <span
        aria-hidden='true'
        className='absolute left-0 top-1.5 w-3 h-3 rounded-full bg-foreground/80 ring-4 ring-background'
      />

      <header className='flex flex-wrap items-center gap-3'>
        <time className='text-xs font-bold uppercase tracking-widest text-muted-foreground'>
          {entry.date}
        </time>
        <span className='status-pill border-border text-muted-foreground'>
          Stage: {entry.stage}
        </span>
      </header>

      <h3 className='mt-3 text-2xl md:text-3xl font-bold tracking-tight text-foreground'>
        {entry.title}
      </h3>

      <div className='mt-8 flex flex-col gap-8'>
        {/* What we built */}
        <section>
          <h4 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-4'>
            What We Built
          </h4>
          <ul className='flex flex-col gap-3'>
            {entry.built.map((item) => (
              <li
                key={item}
                className='glow-border rounded-xl bg-card px-5 py-4 text-sm text-muted-foreground leading-relaxed'
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {blocks.map((block) => (
          <section key={block.key}>
            <h4 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-3'>
              {block.label}
            </h4>
            <p className='text-base text-muted-foreground leading-relaxed max-w-2xl'>
              {entry[block.key]}
            </p>
          </section>
        ))}

        {/* Next milestone */}
        <section className='glow-border rounded-2xl bg-card p-6 md:p-8 max-w-2xl'>
          <h4 className='text-xs uppercase tracking-widest text-muted-foreground/60 mb-3'>
            Next Milestone
          </h4>
          <p className='text-base font-medium text-foreground leading-relaxed'>
            {entry.nextMilestone}
          </p>
        </section>
      </div>
    </article>
  );
}

export default function JourneyTimeline({
  entries,
}: {
  entries: JourneyEntry[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // The rail draws itself as you read — progress made literal.
      gsap.fromTo(
        railRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 70%',
            end: 'bottom 70%',
            scrub: 0.6,
          },
        },
      );

      gsap.fromTo(
        '.journey-entry',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: containerRef.current, start: 'top 80%' },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className='relative'>
      {/* Timeline rail */}
      <div
        className='absolute left-1.5 top-2 bottom-0 w-px bg-border overflow-hidden'
        aria-hidden='true'
      >
        <div ref={railRef} className='w-full h-full bg-foreground/40' />
      </div>

      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
