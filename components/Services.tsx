'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics';

gsap.registerPlugin(ScrollTrigger);

const engagements = [
  {
    tag: 'Start Here',
    title: 'Discovery & Architecture',
    description:
      'We deep-dive into how your business operates, where the process breaks, and what the system needs to do. You leave with an architecture and a delivery plan — whether or not we build it.',
    features: [
      'Operational & technical audit',
      'System architecture and data model',
      'Scope, sequence and delivery plan',
      'Fixed scope, fixed timeline',
    ],
  },
  {
    tag: 'Core Engagement',
    title: 'Design & Build',
    description:
      'We design and develop the product or infrastructure end to end — websites, web applications, SaaS, custom software, or the automation layer connecting them.',
    features: [
      'Product design and development',
      'Integrations and automation',
      'Deployment and handover',
      'Documentation your team can work from',
      'Working increments throughout, not a black box',
    ],
    featured: true,
  },
  {
    tag: 'Ongoing',
    title: 'Growth & Optimization',
    description:
      'Once the digital foundation is in place, we build the systems that help a business attract, qualify, convert and retain customers — and keep improving them against real data.',
    features: [
      'Client acquisition systems',
      'Lead qualification & nurturing flows',
      'Conversion and funnel optimization',
      'Performance measurement and reporting',
    ],
  },
];

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.service-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='engagements'
      ref={sectionRef}
      className='py-24 md:py-28 px-6'
      aria-labelledby='engagements-heading'
    >
      <div className='max-w-5xl mx-auto'>
        <div className='text-center mb-16'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            Working Together
          </p>
          <h2
            id='engagements-heading'
            className='text-4xl md:text-5xl font-bold leading-tight gradient-text'
          >
            Three Ways to
            <br />
            <span className='text-foreground'>Start With Us</span>
          </h2>
          <p className='mt-5 text-muted-foreground max-w-lg mx-auto text-base leading-relaxed'>
            We don&apos;t sell courses or templates. We architect, build and run
            the systems your business operates on.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-start'>
          {engagements.map((s) => (
            <div
              key={s.title}
              className={`service-card relative rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300
                ${
                  s.featured
                    ? 'bg-foreground text-background border border-foreground'
                    : 'bg-card glow-border hover:border-foreground/20'
                }
              `}
            >
              {s.featured && (
                <div className='absolute -top-3 left-1/2 -translate-x-1/2 bg-background text-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-border whitespace-nowrap'>
                  The Core Build
                </div>
              )}

              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                    s.featured
                      ? 'bg-background/15 text-background/80'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {s.tag}
                </span>
              </div>

              <div>
                <h3
                  className={`text-xl font-bold mb-1 ${s.featured ? 'text-background' : 'text-foreground'}`}
                >
                  {s.title}
                </h3>
                <p
                  className={`text-sm leading-relaxed ${s.featured ? 'text-background/70' : 'text-muted-foreground'}`}
                >
                  {s.description}
                </p>
              </div>

              <ul className='flex flex-col gap-2.5 flex-1'>
                {s.features.map((f) => (
                  <li key={f} className='flex items-start gap-2.5 text-sm'>
                    <CheckCircle2
                      size={15}
                      aria-hidden='true'
                      className={`mt-0.5 shrink-0 ${s.featured ? 'text-background/60' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={
                        s.featured
                          ? 'text-background/80'
                          : 'text-muted-foreground'
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href='#contact'
                onClick={() =>
                  track('start_project_click', {
                    location: 'engagements',
                    engagement: s.title,
                  })
                }
                className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm py-3 px-5 transition-all duration-200 group
                  ${
                    s.featured
                      ? 'bg-background text-foreground hover:bg-background/90'
                      : 'bg-secondary hover:bg-accent text-foreground'
                  }`}
              >
                Start a Project
                <ArrowRight
                  size={14}
                  aria-hidden='true'
                  className='group-hover:translate-x-1 transition-transform duration-200'
                />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
