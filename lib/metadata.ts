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

/** The size of every OG image this site generates itself. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * A project's generated share card (app/og/work/[slug]/route.tsx): its
 * screenshot and name on a 1200×630 PNG, in place of the raw screenshot.
 */
export function projectOgImage(slug: string): string {
  return `/og/work/${encodeURIComponent(slug)}`;
}

/** Whether `src` is one of the PNGs generated above, of known size. */
function isGeneratedOgImage(src: string): boolean {
  return src === SITE_OG_IMAGE || src.startsWith('/og/work/');
}

/**
 * Whether the platforms that unfurl links can actually show `src`.
 *
 * WebP and AVIF are the site's default screenshot formats and are fine on the
 * page, but LinkedIn, WhatsApp and Facebook's crawler render a card with no
 * image at all when og:image points at one — which is what every project page
 * shipped with. SVG is not accepted by any of them. Only the extension is
 * read: a remote CMS image is never fetched here.
 */
export function isShareableImage(src: string | undefined): src is string {
  if (!src) return false;
  const path = src.split(/[?#]/)[0].toLowerCase();
  return !/\.(webp|avif|svg)$/.test(path);
}

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
  /** `og:image`. Defaults to the site-wide image, and falls back to it when
   *  the one given is in a format link previews cannot show. */
  image?: string;
  /** `og:image:alt`. Defaults to the social title. */
  imageAlt?: string;
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
  imageAlt,
  publishedTime,
  modifiedTime,
  robots,
}: PageMetadataInput): Metadata {
  // An absolute title already ends in the company name; appending it again
  // would give the home page "… — Unchained Business — Unchained Business".
  const social =
    socialTitle ?? (titleAbsolute ? title : `${title} — ${siteConfig.name}`);

  const url = isShareableImage(image) ? image : SITE_OG_IMAGE;
  // Facebook and WhatsApp skip the image on a URL's first share unless its
  // size is declared, so it is — wherever this site knows it, which is for the
  // images it generates. A CMS upload's size is not known here and is left
  // for the crawler to read.
  const ogImage = {
    url,
    alt: imageAlt ?? social,
    ...(isGeneratedOgImage(url)
      ? { ...OG_IMAGE_SIZE, type: 'image/png' }
      : {}),
  };

  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: social,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      locale: 'en_US',
      type,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: social,
      description,
      images: [{ url: ogImage.url, alt: ogImage.alt }],
    },
    ...(robots ? { robots } : {}),
  };
}
