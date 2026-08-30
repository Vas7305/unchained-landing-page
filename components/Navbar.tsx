'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';
import logo from '@/public/unchained-business-logo.png';
import { track } from '@/lib/analytics';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Absolute paths so the nav behaves identically from every route,
// including the anchored homepage sections.
const navLinks: { key: TranslationKey; href: string }[] = [
  { key: 'nav.whatWeBuild', href: '/#what-we-build' },
  { key: 'nav.ourWork', href: '/work' },
  { key: 'nav.journey', href: '/journey' },
  { key: 'nav.howWeWork', href: '/#how-we-work' },
  { key: 'nav.faq', href: '/#faq' },
];

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslation();

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 },
    );
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'backdrop-blur-md bg-background/70 border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4'>
        {/* Logo */}
        <Link href='/' className='flex items-center group shrink-0'>
          <Image
            src={logo}
            alt={t('common.homeAlt')}
            priority
            className='h-9 md:h-10 w-auto'
          />
        </Link>

        {/* Desktop Nav */}
        <nav aria-label={t('nav.mainNav')} className='hidden md:flex items-center gap-7'>
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className='text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        {/* Language + CTA */}
        <div className='hidden md:flex items-center gap-2'>
          <LanguageSwitcher />
          <Link
            href='/#contact'
            onClick={() => track('start_project_click', { location: 'navbar' })}
            className='text-sm bg-foreground text-background font-semibold px-5 py-2.5 rounded-lg hover:bg-foreground/90 transition-all duration-200'
          >
            {t('nav.startProject')}
          </Link>
        </div>

        {/* Mobile: language switcher stays reachable without opening the menu */}
        <div className='flex items-center gap-1 md:hidden'>
          <LanguageSwitcher />
          <button
            type='button'
            onClick={() => setMenuOpen(!menuOpen)}
            className='text-foreground p-1'
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls='mobile-menu'
          >
            {menuOpen ? (
              <X size={22} aria-hidden='true' />
            ) : (
              <Menu size={22} aria-hidden='true' />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav
          id='mobile-menu'
          aria-label={t('nav.mobileNav')}
          className='md:hidden glass border-t border-border px-6 py-6 flex flex-col gap-5'
        >
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className='text-base text-muted-foreground hover:text-foreground transition-colors py-1'
            >
              {t(link.key)}
            </Link>
          ))}
          <Link
            href='/#contact'
            onClick={() => {
              track('start_project_click', { location: 'navbar_mobile' });
              setMenuOpen(false);
            }}
            className='text-sm bg-foreground text-background font-semibold px-5 py-3 rounded-lg text-center mt-1'
          >
            {t('nav.startProject')}
          </Link>

          <div className='pt-5 mt-1 border-t border-border'>
            <LanguageSwitcher
              variant='inline'
              onSelected={() => setMenuOpen(false)}
            />
          </div>
        </nav>
      )}
    </header>
  );
}
