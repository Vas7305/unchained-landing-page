'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Twitter, Linkedin, Instagram } from 'lucide-react';
import logo from '@/public/unchained-business-logo.png';
import { siteConfig, pillars } from '@/lib/site';
import { useTranslation } from '@/lib/i18n/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n/dictionaries';

const footerColumns: {
  heading: TranslationKey;
  links: { key: TranslationKey; href: string }[];
}[] = [
  {
    heading: 'footer.capabilities',
    links: pillars.map((p) => ({
      key: `pillar.${p.slug}` as TranslationKey,
      href: `/${p.slug}`,
    })),
  },
  {
    heading: 'footer.company',
    links: [
      { key: 'nav.ourWork', href: '/work' },
      { key: 'footer.theJourney', href: '/journey' },
      { key: 'nav.howWeWork', href: '/#how-we-work' },
      { key: 'nav.faq', href: '/#faq' },
    ],
  },
];

const socials = [
  { icon: Twitter, href: siteConfig.social.twitter, label: 'Twitter' },
  { icon: Linkedin, href: siteConfig.social.linkedin, label: 'LinkedIn' },
  { icon: Instagram, href: siteConfig.social.instagram, label: 'Instagram' },
];

export default function Footer() {
  const t = useTranslation();

  return (
    <footer className='border-t border-border bg-card/40'>
      <div className='max-w-6xl mx-auto px-6 py-16'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-12'>
          {/* Brand */}
          <div className='flex flex-col gap-4 md:col-span-2'>
            <Link href='/' className='flex items-center w-fit'>
              <Image
                src={logo}
                alt={t('common.homeAlt')}
                className='h-9 w-auto'
              />
            </Link>
            <p className='text-sm text-muted-foreground max-w-xs leading-relaxed'>
              {t('footer.tagline')}
            </p>
            <div className='flex items-center gap-3 mt-1'>
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`${siteConfig.name} on ${label}`}
                  className='w-8 h-8 rounded-lg bg-secondary glow-border flex items-center justify-center hover:bg-accent transition-colors duration-200'
                >
                  <Icon
                    size={14}
                    aria-hidden='true'
                    className='text-muted-foreground'
                  />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {footerColumns.map((col) => (
            <nav
              key={col.heading}
              aria-label={t(col.heading)}
              className='flex flex-col gap-4'
            >
              <h2 className='text-xs font-semibold uppercase tracking-widest text-foreground/60'>
                {t(col.heading)}
              </h2>
              <ul className='flex flex-col gap-2.5'>
                {col.links.map((l) => (
                  <li key={l.key}>
                    <Link
                      href={l.href}
                      className='text-sm text-muted-foreground hover:text-foreground transition-colors duration-200'
                    >
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className='mt-14 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/50'>
          <span>
            © {new Date().getFullYear()} {siteConfig.name}.{' '}
            {t('footer.rights')}
          </span>
          <span>{t('footer.motto')}</span>
        </div>
      </div>
    </footer>
  );
}
