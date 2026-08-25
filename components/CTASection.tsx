'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Calendar } from 'lucide-react';
import { track } from '@/lib/analytics';
import { siteConfig } from '@/lib/site';

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-inner',
        { y: 50, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='contact'
      ref={sectionRef}
      className='py-24 md:py-28 px-6'
      aria-labelledby='contact-heading'
    >
      <div className='max-w-4xl mx-auto'>
        <div className='cta-inner relative rounded-3xl overflow-hidden glow-border bg-card p-10 md:p-20 text-center'>
          {/* Gradient blob */}
          <div
            className='absolute inset-0 pointer-events-none'
            aria-hidden='true'
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(180,180,200,0.06) 0%, transparent 80%)',
            }}
          />

          <div className='relative z-10 flex flex-col items-center gap-8'>
            <div className='inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground tracking-wide uppercase'>
              <Calendar size={12} aria-hidden='true' />
              Free 30-Minute Intro Call
            </div>

            <h2
              id='contact-heading'
              className='text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight'
            >
              <span className='gradient-text'>Tell Us What You&apos;re</span>
              <br />
              <span className='text-foreground'>Trying to Build.</span>
            </h2>

            <p className='text-muted-foreground max-w-xl text-base md:text-lg leading-relaxed'>
              Bring us the problem, not the spec. We&apos;ll map what the system
              needs to do, tell you what it would realistically take to build,
              and be straight with you if it isn&apos;t a fit.
            </p>

            <div className='flex flex-col sm:flex-row items-center gap-4'>
              <a
                href={siteConfig.bookingUrl}
                target='_blank'
                rel='noopener noreferrer'
                onClick={() => {
                  track('start_project_click', { location: 'cta' });
                  track('booking_cta_click', { location: 'cta' });
                }}
                className='group inline-flex items-center gap-2 bg-foreground text-background font-bold px-8 py-4 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200 shadow-xl'
              >
                Start a Project
                <ArrowRight
                  size={16}
                  aria-hidden='true'
                  className='group-hover:translate-x-1 transition-transform duration-200'
                />
              </a>
              <p className='text-xs text-muted-foreground'>
                No sales pressure. No obligation. Just clarity.
              </p>
            </div>

            {/* Secondary paths — not every visitor is ready for a call */}
            <div className='flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-3 w-full mt-2 pt-8 border-t border-border text-sm'>
              <Link
                href='/work'
                onClick={() => track('explore_work_click', { location: 'cta' })}
                className='text-muted-foreground hover:text-foreground transition-colors duration-200'
              >
                Not ready? Explore our work →
              </Link>
              <Link
                href='/journey'
                onClick={() =>
                  track('follow_journey_click', { location: 'cta' })
                }
                className='text-muted-foreground hover:text-foreground transition-colors duration-200'
              >
                Or follow the journey →
              </Link>
            </div>

            {/* How we work — commitments we can actually keep */}
            <div className='flex items-center flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/50'>
              {[
                'Fixed-scope discovery',
                'Working increments, not black boxes',
                'You own everything we build',
              ].map((b) => (
                <span key={b} className='flex items-center gap-1.5'>
                  <span
                    className='w-1 h-1 rounded-full bg-muted-foreground/30'
                    aria-hidden='true'
                  />
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
