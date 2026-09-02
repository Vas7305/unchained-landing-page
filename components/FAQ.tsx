'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
// The list lives in lib/faq.ts so the homepage's FAQPage JSON-LD is generated
// from the same questions this section renders, and the two cannot drift.
import { faqItems } from '@/lib/faq';

gsap.registerPlugin(ScrollTrigger);

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
  const t = useTranslation();
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
            {t('faq.eyebrow')}
          </p>
          <h2
            id='faq-heading'
            className='text-4xl md:text-5xl font-bold gradient-text'
          >
            {t('faq.title')}
          </h2>
        </div>

        <div className='faq-inner glow-border rounded-2xl bg-card px-6 md:px-10 py-2'>
          {faqItems.map((f) => (
            <FAQItem key={f.q} q={t(f.q)} a={t(f.a)} />
          ))}
        </div>
      </div>
    </section>
  );
}
