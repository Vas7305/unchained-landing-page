import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SkipLink from '@/components/SkipLink';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { defaultLocale } from '@/lib/i18n/config';
import { siteConfig } from '@/lib/site';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'software development',
    'web development',
    'web application development',
    'business automation',
    'digital infrastructure',
    'growth systems',
    'client acquisition',
    'custom software',
    'SaaS development',
  ],
  openGraph: {
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `lang` is the prerendered default; LanguageProvider updates it on the
    // client whenever the visitor picks another language.
    <html lang={defaultLocale} className='dark'>
      <body className={`${inter.variable} antialiased`}>
        <LanguageProvider>
          <SkipLink />
          <Navbar />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
