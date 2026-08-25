'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Plus, Minus } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const faqs = [
  {
    q: 'What exactly does Unchained Business build?',
    a: 'Digital infrastructure: websites, web applications, SaaS products and custom software; the automation layer that connects your tools and removes manual work; and the growth systems that turn attention and leads into predictable opportunities. Most engagements involve more than one of the three.',
  },
  {
    q: 'How established is the company?',
    a: 'We are early stage, and we would rather say so than imply otherwise. The domain was established around eight months ago. TanCerca — a full marketplace platform with merchant systems, payments, subscriptions and delivery infrastructure — is our first completed flagship product, and five further projects are in development. What we can demonstrate today is technical capability. Client outcomes are what we are building next, and we publish them as they happen.',
  },
  {
    q: 'Why should I work with an early-stage company?',
    a: 'Because you get the people who architect the system actually building it, and a company whose reputation depends on your project going well. We are transparent about the trade-off: we are not the safe, established choice, and if you need a decade of comparable case studies, we are not it yet. What we offer instead is senior attention, a documented process, and work you can inspect.',
  },
  {
    q: 'Can I see what you have built?',
    a: 'Yes — that is the point of our portfolio. TanCerca has a full project page covering its architecture, the problem it solves and what it demonstrates technically. The projects still in development are listed with their real status, and we publish each one when it launches rather than before.',
  },
  {
    q: 'Do you still build client acquisition systems?',
    a: 'Yes. It is now one of three pillars rather than the whole company. Growth systems work best once the digital foundation underneath them is solid, so we often build or repair that foundation first — and then the acquisition, qualification, nurturing and conversion layer on top of it.',
  },
  {
    q: 'How do projects usually start?',
    a: 'With discovery and architecture: a fixed-scope engagement where we map how your business operates, define the system, and produce a delivery plan. You own that plan whether or not we build it. From there most clients move into a design and build engagement.',
  },
  {
    q: 'What is the investment?',
    a: 'Engagements are scoped to the system being built, so we do not publish generic pricing. On an initial call we will tell you what your project realistically involves and what it would cost — including when the honest answer is that you need something smaller than you asked for.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!bodyRef.current) return;
    if (open) {
      gsap.fromTo(
        bodyRef.current,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out' },
      );
    } else {
      gsap.to(bodyRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
      });
    }
  }, [open]);

  return (
    <div className='border-b border-border last:border-0 py-1'>
      <h3>
        <button
          type='button'
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className='w-full text-left py-5 flex items-center justify-between gap-4 group cursor-pointer'
        >
          <span className='text-sm font-medium text-foreground group-hover:text-foreground/80 transition-colors'>
            {q}
          </span>
          <span className='shrink-0 w-6 h-6 rounded-full border border-border flex items-center justify-center'>
            {open ? (
              <Minus size={12} aria-hidden='true' className='text-muted-foreground' />
            ) : (
              <Plus size={12} aria-hidden='true' className='text-muted-foreground' />
            )}
          </span>
        </button>
      </h3>
      <div
        ref={bodyRef}
        id={panelId}
        className='overflow-hidden'
        style={{ height: 0, opacity: 0 }}
      >
        <p className='pb-5 text-sm text-muted-foreground leading-relaxed max-w-2xl'>
          {a}
        </p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.faq-inner',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id='faq'
      ref={sectionRef}
      className='py-24 md:py-28 px-6 bg-secondary/20'
      aria-labelledby='faq-heading'
    >
      <div className='max-w-3xl mx-auto'>
        <div className='text-center mb-14'>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
            Questions
          </p>
          <h2
            id='faq-heading'
            className='text-4xl md:text-5xl font-bold gradient-text'
          >
            Common Questions
          </h2>
        </div>

        <div className='faq-inner glow-border rounded-2xl bg-card px-6 md:px-10 py-2'>
          {faqs.map((f) => (
            <FAQItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
