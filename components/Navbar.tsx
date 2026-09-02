'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';
import logo from '@/public/unchained-business-logo.png';
import StartProjectButton from '@/components/StartProjectButton';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Absolute paths so the nav behaves identically from every route,
// including the anchored homepage sections. The three pillar pages replace
// the old single "What We Build" anchor link so each is a direct, crawlable
// destination rather than a scroll target on the homepage — the homepage
// section itself (Capabilities, id="what-we-build") is unchanged.
const navLinks: { key: TranslationKey; href: string }[] = [
  { key: 'pillar.software-development', href: '/software-development' },
  { key: 'pillar.business-automation', href: '/business-automation' },
  { key: 'pillar.growth-systems', href: '/growth-systems' },
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
      } ${
        // Open on desktop the frame carries its own surface, so the bar's
        // chrome would only draw a stray line across the rest of the screen.
        menuOpen ? 'md:bg-transparent md:backdrop-blur-none md:border-b-0' : ''
      }`}
    >
      {/* Bar — full width on desktop so the logo and the trigger sit 1cm off
          each screen edge. It is never torn down: opening the menu slides the
          frame in underneath it, so the logo never moves, reloads or flickers.
          The extra pixel on the left absorbs the frame's own 1px border
          (`.glass`), keeping the logo flush with the links below it. */}
      <div className='relative z-10 px-6 md:px-[1cm] md:pl-[calc(1cm_+_1px)] py-4 flex items-center justify-between gap-4'>
        <Link
          href='/'
          onClick={() => setMenuOpen(false)}
          className='flex items-center group shrink-0'
        >
          <Image
            src={logo}
            alt={t('common.homeAlt')}
            priority
            className='h-9 md:h-10 w-auto'
          />
        </Link>

        {/* Language stays reachable without opening the menu */}
        <div className='flex items-center gap-1'>
          <LanguageSwitcher />
          <button
            type='button'
            onClick={() => setMenuOpen(!menuOpen)}
            className='text-foreground p-1 shrink-0'
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls='primary-menu'
          >
            {menuOpen ? (
              <X size={22} aria-hidden='true' />
            ) : (
              <Menu size={22} aria-hidden='true' />
            )}
          </button>
        </div>
      </div>

      {/* Menu */}
      {menuOpen && (
        <nav
          id='primary-menu'
          aria-label={t('nav.mainNav')}
          className='glass border-t border-border w-full md:absolute md:top-0 md:left-0 md:w-1/4 md:border-t-0 md:border-r md:rounded-br-2xl'
        >
          {/* On desktop the frame reaches the top edge of the screen and the
              bar rides on top of it, so the links clear the bar's 72px row. */}
          <div className='px-6 md:px-[1cm] py-6 md:pt-20 flex flex-col gap-5'>
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
            <StartProjectButton
              source='navbar'
              onOpened={() => setMenuOpen(false)}
              className='text-sm bg-foreground text-background font-semibold px-5 py-3 rounded-lg text-center mt-1'
            />

            <div className='pt-5 mt-1 border-t border-border'>
              <LanguageSwitcher
                variant='inline'
                onSelected={() => setMenuOpen(false)}
              />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
