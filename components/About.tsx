'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';

gsap.registerPlugin(ScrollTrigger);

const principles = [
  {
    title: 'Build',
    body: 'Make the thing. Real products, in production, with real constraints.',
  },
  {
    title: 'Measure',
    body: 'Track what the system actually does, not what we hoped it would do.',
  },
  {
    title: 'Document',
    body: 'Publish the result — including the parts that did not work.',
  },
  {
    title: 'Improve',
    body: 'Feed every lesson back into the next build.',
  },
  {
    title: 'Scale',
    body: 'Repeat what proves itself. Discard what does not.',
  },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.about-col',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );

      gsap.fromTo(
        '.principle-step',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.principle-list', start: 'top 85%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='about'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 bg-secondary/20'
      aria-labelledby='about-heading'
    >
      <div className='max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start'>
        {/* Narrative */}
        <div className='about-col'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            Who We Are
          </p>
          <h2
            id='about-heading'
            className='text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight'
          >
            <span className='gradient-text'>Our First Case Study</span>
            <br />
            <span className='text-foreground'>Is Ourselves.</span>
          </h2>

          <div className='mt-6 flex flex-col gap-4 text-muted-foreground text-base leading-relaxed'>
            <p>
              Before we ask businesses to trust us with their growth, we&apos;re
              putting our own systems, decisions and execution to the test.
            </p>
            <p>
              Unchained Business is an early-stage technology company. We
              don&apos;t have a decade of case studies behind us — we have a
              flagship product in production, five more projects in development,
              and a deliberate plan to earn the rest.
            </p>
            <p className='text-foreground font-medium'>
              We&apos;re not trying to look established. We&apos;re building
              something worth becoming established for.
            </p>
          </div>

          <Link
            href='/journey'
            onClick={() => track('follow_journey_click', { location: 'about' })}
            className='group mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground'
          >
            Read the journey log
            <ArrowRight
              size={14}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </Link>
        </div>

        {/* Operating principle */}
        <div className='about-col glow-border rounded-3xl bg-card p-8 md:p-10'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground/70 mb-6 font-medium'>
            How we operate
          </p>

          <ol className='principle-list flex flex-col'>
            {principles.map((p, i) => (
              <li
                key={p.title}
                className='principle-step relative flex gap-4 pb-6 last:pb-0'
              >
                {/* Connector */}
                {i < principles.length - 1 && (
                  <span
                    className='absolute left-3 top-7 bottom-0 w-px bg-border'
                    aria-hidden='true'
                  />
                )}
                <span
                  className='relative z-10 shrink-0 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular-nums'
                  aria-hidden='true'
                >
                  {i + 1}
                </span>
                <div className='pt-0.5'>
                  <h3 className='text-sm font-semibold text-foreground'>
                    {p.title}
                  </h3>
                  <p className='text-sm text-muted-foreground leading-relaxed mt-0.5'>
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
