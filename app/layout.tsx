import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SkipLink from '@/components/SkipLink';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
import { CommercialRoutingProvider } from '@/lib/commercial/RoutingProvider';
import CommercialContactPanel from '@/components/CommercialContactPanel';
import { defaultLocale } from '@/lib/i18n/config';
import { siteConfig } from '@/lib/site';
import JsonLd from '@/components/JsonLd';
import { organizationSchema } from '@/lib/structured-data';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

/**
 * Site-wide defaults only.
 *
 * The homepage's Open Graph block, canonical and Twitter card used to live
 * here, which is why every other route advertised itself socially as the
 * homepage: Next.js replaces `openGraph` wholesale per segment, so a page that
 * declared none inherited the homepage's. Those values now sit on the homepage
 * itself (app/page.tsx) and every indexable route builds its own through
 * `buildPageMetadata` (lib/metadata.ts).
 *
 * `metadataBase` stays here: it is what resolves every relative canonical and
 * image below onto the canonical host, from the single URL in siteConfig.
 */
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
        {/* The site's one Organization entity, emitted once from the layout so
            every page carries the same identity and no page declares a second
            one. Article `publisher`/`author` reference it by `@id`. */}
        <JsonLd data={organizationSchema()} />
        <LanguageProvider>
          {/* Inside LanguageProvider: routing sends the active locale as the
              inquiry's language, so it has to be able to read it (§8). The
              contact panel is mounted once, here, rather than beside each CTA
              — five buttons on a page must open one dialog, not five. */}
          <CommercialRoutingProvider>
            <SkipLink />
            <Navbar />
            {children}
            <Footer />
            <CommercialContactPanel />
          </CommercialRoutingProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
