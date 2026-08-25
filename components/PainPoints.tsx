'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Boxes, Repeat, Unplug, Waypoints } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const pains = [
  {
    icon: Repeat,
    title: 'Manual Work That Should Be Automatic',
    body: 'Your team re-types the same data, chases the same approvals, and rebuilds the same report every week. The process works — but only because people keep carrying it.',
  },
  {
    icon: Unplug,
    title: 'Tools That Do Not Talk to Each Other',
    body: 'Six subscriptions, six sources of truth, and a spreadsheet holding them together. Every integration gap becomes someone’s daily copy-and-paste job.',
  },
  {
    icon: Boxes,
    title: 'Software That Fights How You Operate',
    body: 'Off-the-shelf tools force your business to work their way. So you build workarounds around the workarounds, and the real process lives in people’s heads.',
  },
  {
    icon: Waypoints,
    title: 'Growth That Depends on Someone Remembering',
    body: 'Leads arrive, then stall. Follow-up happens when there is time. Nothing is broken exactly — it is just that none of it is a system yet.',
  },
];

export default function PainPoints() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pain-card',
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 80%',
          },
        },
      );

      gsap.fromTo(
        '.pain-heading',
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
          },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='problem'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 relative'
    >
      <div className='max-w-5xl mx-auto'>
        {/* Header */}
        <div className='pain-heading text-center mb-16'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            Sound Familiar?
          </p>
          <h2 className='text-4xl md:text-5xl font-bold leading-tight gradient-text'>
            The Business Works.
            <br />
            <span className='text-foreground'>
              The Infrastructure Doesn&apos;t.
            </span>
          </h2>
          <p className='mt-5 text-muted-foreground max-w-xl mx-auto text-base leading-relaxed'>
            Most growing businesses are held together by effort rather than by
            systems. That works right up until the moment it has to scale.
          </p>
        </div>

        {/* Cards */}
        <div ref={cardsRef} className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
          {pains.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className='pain-card glow-border rounded-2xl p-7 bg-card transition-all duration-300 hover:border-foreground/15 group'
              >
                <div className='w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-5 group-hover:bg-accent transition-colors duration-300'>
                  <Icon
                    size={18}
                    className='text-muted-foreground group-hover:text-foreground transition-colors'
                  />
                </div>
                <h3 className='font-semibold text-foreground text-base mb-2'>
                  {p.title}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
