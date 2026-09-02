'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { locales, type Locale } from '@/lib/i18n/config';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { track } from '@/lib/analytics';

type Props = {
  /** `dropdown` for the desktop bar, `inline` for the open mobile menu. */
  variant?: 'dropdown' | 'inline';
  /** Called after a language is picked — lets the mobile menu close itself. */
  onSelected?: () => void;
};

export default function LanguageSwitcher({
  variant = 'dropdown',
  onSelected,
}: Props) {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = locales.find((l) => l.code === locale) ?? locales[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (next: Locale) => {
    if (next !== locale) {
      setLocale(next);
      track('language_change', { from: locale, to: next });
    }
    setOpen(false);
    onSelected?.();
  };

  if (variant === 'inline') {
    return (
      <div className='flex flex-col gap-3'>
        <span className='flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground/60'>
          <Globe size={14} aria-hidden='true' />
          {t('language.label')}
        </span>
        <div role='group' aria-label={t('language.select')} className='flex flex-wrap gap-2'>
          {locales.map((l) => (
            <button
              key={l.code}
              type='button'
              lang={l.code}
              onClick={() => choose(l.code)}
              aria-current={l.code === locale ? 'true' : undefined}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors duration-200 ${
                l.code === locale
                  ? 'border-foreground/40 bg-secondary text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className='relative'>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label={`${t('language.select')} — ${current.label}`}
        aria-haspopup='menu'
        aria-expanded={open}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 p-2 rounded-lg hover:bg-secondary/60'
      >
        <Globe size={18} aria-hidden='true' />
        <span className='text-xs font-medium uppercase tracking-wide'>
          {current.code}
        </span>
      </button>

      {open && (
        <div
          role='menu'
          aria-label={t('language.label')}
          className='absolute right-0 top-full mt-2 min-w-44 glass border border-border rounded-xl p-1.5 shadow-xl z-50'
        >
          {locales.map((l) => (
            <button
              key={l.code}
              type='button'
              role='menuitemradio'
              aria-checked={l.code === locale}
              lang={l.code}
              onClick={() => choose(l.code)}
              className={`w-full flex items-center justify-between gap-3 text-sm text-left px-3 py-2 rounded-lg transition-colors duration-150 ${
                l.code === locale
                  ? 'text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              {l.label}
              {l.code === locale && (
                <Check size={14} aria-hidden='true' className='shrink-0' />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
