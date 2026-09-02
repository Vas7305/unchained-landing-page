/**
 * The site's one metadata builder.
 *
 * Module 1 gave every indexable route a correct title, description and
 * canonical, but left the Open Graph block to the root layout — which owns the
 * *homepage's* values. Any route without its own `openGraph` therefore
 * advertised itself socially as the homepage. Next.js replaces the whole
 * `openGraph` object per segment rather than merging it field by field, so the
 * fix is for each route to declare a complete block of its own, and for there
 * to be exactly one place that knows how to build one.
 *
 * This is not a second metadata system: routes still export `metadata` /
 * `generateMetadata` exactly as before, and `siteConfig` remains the only
 * source of the site's name and URL.
 */

import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site';

/**
 * The site-wide OG image, produced by the root `app/opengraph-image.tsx` file
 * convention. A route that declares its own `openGraph` object no longer picks
 * that file up implicitly, so every page built here names it explicitly —
 * relative, so `metadataBase` resolves it against the canonical host and the
 * domain is written down once.
 */
export const SITE_OG_IMAGE = '/opengraph-image';

/** An absolute URL on the canonical host, from a root-relative path. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, `${siteConfig.url}/`).toString();
}

export type PageMetadataInput = {
  /** Page title. Runs through the root layout's `%s — Unchained Business`
   *  template unless `titleAbsolute` is set. */
  title: string;
  /** For the homepage, whose title already contains the company name. */
  titleAbsolute?: boolean;
  description: string;
  /** Root-relative path. Becomes the canonical and the `og:url`. */
  path: string;
  /** `og:title` / `twitter:title`. Defaults to `<title> — Unchained
   *  Business`, or to the title alone when it is already absolute. */
  socialTitle?: string;
  /** `og:type`. Defaults to `website`. */
  type?: 'website' | 'article';
  /** `og:image`. Defaults to the site-wide image. */
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  robots?: Metadata['robots'];
};

export function buildPageMetadata({
  title,
  titleAbsolute,
  description,
  path,
  socialTitle,
  type = 'website',
  image = SITE_OG_IMAGE,
  publishedTime,
  modifiedTime,
  robots,
}: PageMetadataInput): Metadata {
  // An absolute title already ends in the company name; appending it again
  // would give the home page "… — Unchained Business — Unchained Business".
  const social =
    socialTitle ?? (titleAbsolute ? title : `${title} — ${siteConfig.name}`);

  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: social,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      type,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: social,
      description,
    },
    ...(robots ? { robots } : {}),
  };
}
