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
  const panelRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The frame outlives `menuOpen` by the length of its closing tween, so the
  // menu can animate out instead of vanishing on the state change.
  const [menuMounted, setMenuMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Desktop only: the bar and the frame take the screen in turn rather than
  // together. `sequencing` stays true from the opening click until the bar has
  // faded back in, so the bar's chrome is timed to the handover instead of
  // drifting through it on its usual half-second transition.
  const [isDesktop, setIsDesktop] = useState(false);
  const [sequencing, setSequencing] = useState(false);
  const t = useTranslation();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  // Desktop hands the screen over one element at a time: the bar's controls
  // fade out before the frame is mounted, and only come back once the frame's
  // closing tween has finished (it unmounts, flipping `menuMounted`). On phones
  // the bar keeps its controls throughout, so it is never touched.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    // Phones keep the bar and its controls throughout, so nothing here applies
    // — and a layout change back down to phone width must not strand the
    // controls behind a desktop fade-out.
    if (!isDesktop) {
      gsap.set(bar, { clearProps: 'opacity,visibility' });
      return;
    }

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (menuOpen) {
      if (menuMounted) return;
      // Step one of opening: the bar empties out. The frame is not mounted —
      // and so cannot start its own tween — until this has finished.
      const tween = gsap.to(bar, {
        autoAlpha: 0,
        duration: reduced ? 0.01 : 0.22,
        ease: 'power2.in',
        onComplete: () => setMenuMounted(true),
      });
      return () => {
        tween.kill();
      };
    }

    // Closed: while the frame is still mounted it is animating out, so the bar
    // waits. Step two of closing runs once the frame has unmounted.
    if (menuMounted || !sequencing) return;
    const tween = gsap.to(bar, {
      autoAlpha: 1,
      duration: reduced ? 0.01 : 0.24,
      ease: 'power2.out',
      onComplete: () => setSequencing(false),
    });
    return () => {
      tween.kill();
    };
  }, [menuOpen, menuMounted, isDesktop, sequencing]);

  // With no close button on desktop, a click anywhere off the nav closes the
  // menu — as does Escape, so the keyboard is not left without a way out.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!menuMounted || !panel) return;

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const items = panel.querySelectorAll<HTMLElement>('[data-menu-item]');

    // Opening: the frame drops out from under the bar, its rows following in a
    // short stagger. Closing: it lifts straight back up, quicker than it came.
    const tl = menuOpen
      ? gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .fromTo(
            panel,
            { opacity: 0, y: -18 },
            { opacity: 1, y: 0, duration: reduced ? 0.01 : 0.45 },
          )
          .fromTo(
            items,
            { opacity: 0, y: -10 },
            {
              opacity: 1,
              y: 0,
              duration: reduced ? 0.01 : 0.4,
              stagger: reduced ? 0 : 0.045,
            },
            reduced ? '<' : '-=0.3',
          )
      : gsap.timeline({ onComplete: () => setMenuMounted(false) }).to(panel, {
          opacity: 0,
          y: -14,
          duration: reduced ? 0.01 : 0.26,
          ease: 'power2.in',
        });

    return () => {
      tl.kill();
    };
  }, [menuOpen, menuMounted]);

  return (
    <header
      ref={navRef}
      // The bar's own chrome is part of what has to clear the screen before
      // the frame arrives, so during the handover it drops its half-second
      // transition and moves at the pace of the two steps around it.
      style={
        isDesktop && (menuOpen || menuMounted || sequencing)
          ? { transitionDuration: '200ms' }
          : undefined
      }
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'backdrop-blur-md bg-background/70 border-b border-border'
          : 'bg-transparent'
      } ${
        // Open on desktop the frame carries its own surface, so the bar's
        // chrome would only draw a stray line across the rest of the screen.
        // It stays suppressed until the frame has finished animating out.
        menuOpen || menuMounted
          ? 'md:bg-transparent md:backdrop-blur-none md:border-b-0'
          : ''
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

        {/* Language stays reachable without opening the menu. Once the frame is
            open on desktop it carries its own language row, so the bar is left
            with nothing but the logo — no duplicate switcher, no close button.
            */}
        <div ref={barRef} className='flex items-center gap-1'>
          <LanguageSwitcher />
          <button
            type='button'
            onClick={() => {
              if (!menuOpen) {
                // Phones show the frame straight away; desktop opens it only
                // after the bar has faded, which the sequencing effect drives.
                if (isDesktop) setSequencing(true);
                else setMenuMounted(true);
              }
              setMenuOpen(!menuOpen);
            }}
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
      {menuMounted && (
        <nav
          ref={panelRef}
          id='primary-menu'
          aria-label={t('nav.mainNav')}
          // Hidden until the opening tween takes over, so the frame never
          // flashes at full opacity before the first animated frame.
          style={{ opacity: 0 }}
          className='glass border-t border-border w-full md:absolute md:top-0 md:left-0 md:w-1/4 md:h-screen md:border-t-0 md:border-r'
        >
          {/* On desktop the frame runs the full height of the screen, from the
              top edge — where the bar rides on top of it, so the links clear
              the bar's 72px row — down to a square bottom at the viewport's
              lower edge. */}
          <div className='px-6 md:px-[1cm] py-6 md:pt-20 flex flex-col gap-5'>
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                data-menu-item
                onClick={() => setMenuOpen(false)}
                className='text-base text-muted-foreground hover:text-foreground transition-colors py-1'
              >
                {t(link.key)}
              </Link>
            ))}
            <div data-menu-item className='flex flex-col'>
              <StartProjectButton
                source='navbar'
                onOpened={() => setMenuOpen(false)}
                className='text-sm bg-foreground text-background font-semibold px-5 py-3 rounded-lg text-center mt-1'
              />
            </div>

            <div data-menu-item className='pt-5 mt-1 border-t border-border'>
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
