import { describe, expect, it } from 'vitest';
import { SITE_OG_IMAGE, absoluteUrl, buildPageMetadata } from './metadata';
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
    expect(meta.openGraph?.images).toEqual([SITE_OG_IMAGE]);
    const withOwn = buildPageMetadata({
      title: 'TanCerca',
      description: 'A project.',
      path: '/work/tancerca',
      image: '/work/tancerca-hero.webp',
    });
    expect(withOwn.openGraph?.images).toEqual(['/work/tancerca-hero.webp']);
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
