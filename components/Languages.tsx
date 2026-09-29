'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { track } from '@/lib/analytics';
import { locales, type Locale } from '@/lib/i18n/config';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { languageName } from '@/lib/i18n/languageName';

gsap.registerPlugin(ScrollTrigger);

/**
 * Multilingual capability, shown rather than claimed.
 *
 * Two facts, both read from the code rather than written as copy: the six
 * languages this site runs in (lib/i18n/config.ts), and the languages the
 * published demos' own interfaces are built in (lib/demo/registry.ts, joined
 * with the portfolio on the server). Neither can drift from what is true.
 *
 * The language chips are the site's real switcher in another shape — same
 * `setLocale`, same `language_change` event the header switcher fires — so a
 * visitor can test the claim in one click. Detection and routing are
 * untouched; this only calls what the switcher already calls.
 *
 * The note underneath is the other half of honesty here: the site speaks six
 * languages, but a client's project includes the languages agreed in its
 * scope, and the page says so.
 */
export default function Languages({ demoLanguages }: { demoLanguages: string[] }) {
  const { t, locale, setLocale } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.languages-panel',
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

  const choose = (next: Locale) => {
    if (next === locale) return;
    setLocale(next);
    track('language_change', { from: locale, to: next, location: 'languages' });
  };

  return (
    <section
      id='languages'
      ref={sectionRef}
      className='py-12 md:py-14 px-6'
      aria-labelledby='languages-heading'
    >
      <div className='max-w-4xl mx-auto'>
        <SectionHeading
          eyebrow={t('languages.eyebrow')}
          title={t('languages.title')}
          accent={t('languages.titleAccent')}
          titleId='languages-heading'
          body={t('languages.body')}
        />

        <div className='languages-panel mt-12 glow-border rounded-2xl bg-card p-6 md:p-8 flex flex-col gap-7'>
          <div>
            <h3 className='text-[11px] uppercase tracking-widest text-muted-foreground/80 font-medium mb-3'>
              {t('languages.site')}
            </h3>
            <ul className='flex flex-wrap gap-2'>
              {locales.map((l) => {
                const current = l.code === locale;
                return (
                  <li key={l.code}>
                    <button
                      type='button'
                      lang={l.code}
                      aria-pressed={current}
                      onClick={() => choose(l.code)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-200 ${
                        current
                          ? 'border-foreground/40 bg-accent text-foreground font-semibold'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                      }`}
                    >
                      {/* The current language is marked by a check as well as
                          by colour, so the state does not rest on colour. */}
                      {current && <Check size={13} aria-hidden='true' />}
                      {l.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {demoLanguages.length > 0 && (
            <div>
              <h3 className='text-[11px] uppercase tracking-widest text-muted-foreground/80 font-medium mb-3'>
                {t('languages.demos')}
              </h3>
              <ul className='flex flex-wrap gap-2'>
                {demoLanguages.map((code) => (
                  <li
                    key={code}
                    className='rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
                  >
                    {languageName(code, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className='text-sm text-muted-foreground leading-relaxed border-t border-border pt-5'>
            {t('languages.note')}
          </p>
        </div>
      </div>
    </section>
  );
}
