'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import logo from '@/public/unchained-business-logo.png';

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Results', href: '#results' },
  { label: 'Services', href: '#services' },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 },
    );
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-sm border-b border-border' : 'bg-transparent'
      }`}
    >
      <div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between'>
        {/* Logo */}
        <a href='#' className='flex items-center group'>
          <Image
            src={logo}
            alt='Unchained Business — Client Acquisition Systems'
            priority
            className='h-9 md:h-10 w-auto'
          />
        </a>

        {/* Desktop Nav */}
        <nav className='hidden md:flex items-center gap-8'>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className='text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className='hidden md:flex items-center gap-3'>
          <a
            href='#contact'
            className='text-sm bg-foreground text-background font-semibold px-5 py-2.5 rounded-lg hover:bg-foreground/90 transition-all duration-200'
          >
            Get Started
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className='md:hidden text-foreground p-1'
          aria-label='Toggle menu'
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className='md:hidden glass border-t border-border px-6 py-6 flex flex-col gap-5'>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              {link.label}
            </a>
          ))}
          <a
            href='#contact'
            onClick={() => setMenuOpen(false)}
            className='text-sm bg-foreground text-background font-semibold px-5 py-2.5 rounded-lg text-center'
          >
            Get Started
          </a>
        </div>
      )}
    </header>
  );
}
