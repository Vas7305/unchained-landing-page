import { describe, expect, it } from 'vitest';
import {
  OG_IMAGE_SIZE,
  SITE_OG_IMAGE,
  absoluteUrl,
  buildPageMetadata,
  isShareableImage,
  projectOgImage,
} from './metadata';
import { siteConfig } from './site';

/**
 * The builder that fixes the Open Graph inheritance Module 1 left behind. The
 * checks that matter are the ones asserting a page never carries the
 * homepage's social identity.
 */

describe('absoluteUrl', () => {
  it('resolves a path against the one configured host', () => {
    expect(absoluteUrl('/insights')).toBe(`${siteConfig.url}/insights`);
    expect(absoluteUrl('/work/tancerca')).toBe(`${siteConfig.url}/work/tancerca`);
  });

  it('gives the home page a trailing slash, like its canonical', () => {
    expect(absoluteUrl('/')).toBe(`${siteConfig.url}/`);
    expect(absoluteUrl()).toBe(`${siteConfig.url}/`);
  });
});

describe('buildPageMetadata', () => {
  const meta = buildPageMetadata({
    title: 'Software Development',
    description: 'What this page is about.',
    path: '/software-development',
  });

  it('takes title, description and canonical from the page', () => {
    expect(meta.title).toBe('Software Development');
    expect(meta.description).toBe('What this page is about.');
    expect(meta.alternates?.canonical).toBe('/software-development');
  });

  it('gives the page its own Open Graph title, description and URL', () => {
    expect(meta.openGraph?.title).toBe(
      `Software Development — ${siteConfig.name}`,
    );
    expect(meta.openGraph?.description).toBe('What this page is about.');
    expect(meta.openGraph?.url).toBe(`${siteConfig.url}/software-development`);
  });

  it('never lets the homepage’s Open Graph values stand in', () => {
    expect(meta.openGraph?.title).not.toBe(
      `${siteConfig.name} — ${siteConfig.tagline}`,
    );
    expect(meta.openGraph?.description).not.toBe(siteConfig.description);
    expect(meta.openGraph?.url).not.toBe(absoluteUrl('/'));
  });

  it('always carries an OG image, because declaring openGraph drops the file convention', () => {
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: SITE_OG_IMAGE }),
    ]);
    const withOwn = buildPageMetadata({
      title: 'TanCerca',
      description: 'A project.',
      path: '/work/tancerca',
      image: '/work/merxis-pos.png',
    });
    expect(withOwn.openGraph?.images).toEqual([
      expect.objectContaining({ url: '/work/merxis-pos.png' }),
    ]);
  });

  it('never advertises an image link previews cannot show', () => {
    // A WebP og:image renders as an empty card on LinkedIn, WhatsApp and
    // Facebook, which is what every project page used to ship.
    const webp = buildPageMetadata({
      title: 'TanCerca',
      description: 'A project.',
      path: '/work/tancerca',
      image: '/work/tancerca-hero.webp',
    });
    expect(webp.openGraph?.images).toEqual([
      expect.objectContaining({ url: SITE_OG_IMAGE }),
    ]);
  });

  it('declares size, type and alt for the images it generates', () => {
    for (const image of [SITE_OG_IMAGE, projectOgImage('tancerca')]) {
      const built = buildPageMetadata({
        title: 'TanCerca',
        description: 'A project.',
        path: '/work/tancerca',
        image,
      });
      expect(built.openGraph?.images).toEqual([
        {
          url: image,
          ...OG_IMAGE_SIZE,
          type: 'image/png',
          alt: `TanCerca — ${siteConfig.name}`,
        },
      ]);
    }
  });

  it('does not guess the size of an image it did not generate', () => {
    const built = buildPageMetadata({
      title: 'TanCerca',
      description: 'A project.',
      path: '/work/tancerca',
      image: '/work/merxis-pos.png',
      imageAlt: 'The Merxis POS checkout screen',
    });
    expect(built.openGraph?.images).toEqual([
      { url: '/work/merxis-pos.png', alt: 'The Merxis POS checkout screen' },
    ]);
  });

  it('puts the same image on the Twitter card', () => {
    expect(meta.twitter?.images).toEqual([
      expect.objectContaining({ url: SITE_OG_IMAGE }),
    ]);
  });

  it('mirrors the social title and description onto the Twitter card', () => {
    // `Twitter` is a union over the card types, so the shared fields are read
    // off a narrowed view of the same object rather than through the union.
    const twitter = meta.twitter as { card?: string };
    expect(meta.twitter?.title).toBe(meta.openGraph?.title);
    expect(meta.twitter?.description).toBe(meta.openGraph?.description);
    expect(twitter.card).toBe('summary_large_image');
  });

  it('defaults to a website, and names the site', () => {
    const og = meta.openGraph as { type?: string; siteName?: string };
    expect(og.type).toBe('website');
    expect(og.siteName).toBe(siteConfig.name);
  });

  it('leaves a page indexable unless it is told otherwise', () => {
    expect(meta.robots).toBeUndefined();
    const hidden = buildPageMetadata({
      title: 'A project without a page’s worth of detail',
      description: 'Reachable, not indexable.',
      path: '/work/example',
      robots: { index: false, follow: true },
    });
    expect(hidden.robots).toEqual({ index: false, follow: true });
  });

  it('omits article dates that were not supplied', () => {
    const og = meta.openGraph as {
      publishedTime?: string;
      modifiedTime?: string;
    };
    expect(og.publishedTime).toBeUndefined();
    expect(og.modifiedTime).toBeUndefined();
  });

  it('takes an absolute title for the page whose title is already the site’s', () => {
    const home = buildPageMetadata({
      title: `${siteConfig.name} — ${siteConfig.tagline}`,
      titleAbsolute: true,
      description: siteConfig.description,
      path: '/',
    });
    // Without this the root layout's template would append the company name
    // to a title that already ends in it.
    expect(home.title).toEqual({
      absolute: `${siteConfig.name} — ${siteConfig.tagline}`,
    });
    // …and the social title is not the company name twice over.
    expect(home.openGraph?.title).toBe(
      `${siteConfig.name} — ${siteConfig.tagline}`,
    );
    expect(home.openGraph?.url).toBe(`${siteConfig.url}/`);
  });

  it('accepts an explicit social title', () => {
    const meta = buildPageMetadata({
      title: 'A',
      description: 'B',
      path: '/a',
      socialTitle: 'Something else entirely',
    });
    expect(meta.openGraph?.title).toBe('Something else entirely');
    expect(meta.twitter?.title).toBe('Something else entirely');
  });
});

describe('isShareableImage', () => {
  it('accepts the formats every link preview reads', () => {
    expect(isShareableImage('/work/merxis-pos.png')).toBe(true);
    expect(isShareableImage('/a/photo.JPG')).toBe(true);
    expect(isShareableImage(SITE_OG_IMAGE)).toBe(true);
    expect(isShareableImage(projectOgImage('tancerca'))).toBe(true);
  });

  it('rejects WebP, AVIF and SVG, query string or not', () => {
    expect(isShareableImage('/work/tancerca-hero.webp')).toBe(false);
    expect(isShareableImage('https://x.supabase.co/a.webp?v=2')).toBe(false);
    expect(isShareableImage('/a.avif')).toBe(false);
    expect(isShareableImage('/logo.svg')).toBe(false);
    expect(isShareableImage(undefined)).toBe(false);
  });
});
