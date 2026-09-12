import { describe, expect, it } from 'vitest';
import { buildCmsMetadata, readSeo, type SeoFields } from './seo';
import { SITE_OG_IMAGE, absoluteUrl } from '@/lib/metadata';
import { siteConfig } from '@/lib/site';

/**
 * The SEO fallback chain.
 *
 * The rule these tests encode: every stored field is an OVERRIDE, and a page
 * with none must produce exactly the metadata the site produced before the CMS
 * existed. That is what makes this safe to ship against published pages —
 * nothing changes for content nobody has edited.
 */

const defaults = {
  title: 'TanCerca',
  description: 'A marketplace and digital commerce platform.',
  path: '/work/tancerca',
  type: 'article' as const,
  image: '/work/tancerca-hero.webp',
};

describe('readSeo', () => {
  it('is undefined when the editor set nothing', () => {
    expect(readSeo({})).toBeUndefined();
    expect(readSeo({ seo_title: null, og_image: null })).toBeUndefined();
  });

  it('omits the fields that were not set, rather than carrying nulls', () => {
    // `localize()` overlays only the keys that are PRESENT, so a null here
    // would blank a parent value it was meant to leave alone.
    const seo = readSeo({ seo_title: 'A better title' });
    expect(seo).toEqual({ title: 'A better title' });
    expect('description' in seo!).toBe(false);
  });

  it('refuses an image on a host we do not control', () => {
    expect(readSeo({ og_image: 'https://example.com/a.png' })).toBeUndefined();
    expect(readSeo({ og_image: '/og/tancerca.png' })).toEqual({
      ogImage: '/og/tancerca.png',
    });
  });

  it('refuses a canonical that is not an absolute URL', () => {
    // A bare host in a canonical tag is a relative URL to every crawler that
    // reads it.
    expect(readSeo({ canonical_url: 'tancercadeti.com' })).toBeUndefined();
    expect(readSeo({ canonical_url: '/work/tancerca' })).toBeUndefined();
    expect(
      readSeo({ canonical_url: 'https://www.tancercadeti.com/' }),
    ).toEqual({ canonicalUrl: 'https://www.tancercadeti.com/' });
  });
});

describe('with no overrides', () => {
  const meta = buildCmsMetadata(defaults, undefined);

  it('takes title and description from the content', () => {
    expect(meta.title).toBe('TanCerca');
    expect(meta.description).toBe(
      'A marketplace and digital commerce platform.',
    );
  });

  it('canonicalises to the page’s own path', () => {
    expect(meta.alternates?.canonical).toBe('/work/tancerca');
  });

  it('gives og:title the company suffix the site has always added', () => {
    expect(meta.openGraph?.title).toBe(`TanCerca — ${siteConfig.name}`);
    expect(meta.openGraph?.url).toBe(absoluteUrl('/work/tancerca'));
  });

  it('uses the content’s own image', () => {
    expect(meta.openGraph?.images).toEqual(['/work/tancerca-hero.webp']);
  });

  it('falls back to the site image when the content has none', () => {
    const bare = buildCmsMetadata({ ...defaults, image: undefined }, undefined);
    expect(bare.openGraph?.images).toEqual([SITE_OG_IMAGE]);
  });
});

describe('with overrides', () => {
  const seo: SeoFields = {
    title: 'Marketplace platform case study',
    description: 'How we built a three-sided marketplace end to end.',
    ogTitle: 'We built a marketplace, its merchant tooling and its delivery',
    ogDescription: 'The longer sentence a social card has room for.',
    ogImage: '/og/tancerca-social.png',
  };

  const meta = buildCmsMetadata(defaults, seo);

  it('prefers the editor’s title and description', () => {
    expect(meta.title).toBe('Marketplace platform case study');
    expect(meta.description).toBe(
      'How we built a three-sided marketplace end to end.',
    );
  });

  it('uses the OG title exactly as written, with no suffix appended', () => {
    // An editor who wrote an og:title meant that string. Appending the company
    // name would push it past the length they were writing to.
    expect(meta.openGraph?.title).toBe(seo.ogTitle);
    expect(meta.openGraph?.title).not.toContain(siteConfig.name);
  });

  it('gives og:description its own value, on both cards', () => {
    expect(meta.openGraph?.description).toBe(seo.ogDescription);
    expect(meta.twitter?.description).toBe(seo.ogDescription);
  });

  it('prefers the editor’s OG image over the content’s', () => {
    expect(meta.openGraph?.images).toEqual(['/og/tancerca-social.png']);
  });
});

describe('the chain, one step at a time', () => {
  it('falls og:title back through the SEO title to the content title', () => {
    const seoOnly = buildCmsMetadata(defaults, { title: 'An SEO title' });
    // No ogTitle set, so the site's own rule applies to the resolved title.
    expect(seoOnly.openGraph?.title).toBe(`An SEO title — ${siteConfig.name}`);
  });

  it('falls og:description back to the SEO description', () => {
    const seoOnly = buildCmsMetadata(defaults, {
      description: 'An SEO description.',
    });
    expect(seoOnly.openGraph?.description).toBe('An SEO description.');
  });

  it('never synthesises a description that nobody wrote', () => {
    // "Do not generate meaningless duplicate metadata": with nothing set, the
    // description is the content's, not a truncation of the body.
    const meta = buildCmsMetadata(defaults, {});
    expect(meta.description).toBe(defaults.description);
  });
});

describe('a canonical override', () => {
  it('replaces the resolved path rather than being treated as one', () => {
    const meta = buildCmsMetadata(defaults, {
      canonicalUrl: 'https://www.tancercadeti.com/',
    });

    expect(meta.alternates?.canonical).toBe('https://www.tancercadeti.com/');
    // og:url still names this site's page: the canonical says where the
    // authoritative copy lives, not where this document is.
    expect(meta.openGraph?.url).toBe(absoluteUrl('/work/tancerca'));
  });
});

describe('robots', () => {
  it('is carried through for a page that must not be indexed', () => {
    const meta = buildCmsMetadata(
      { ...defaults, robots: { index: false, follow: true } },
      undefined,
    );
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('is absent for an ordinary page', () => {
    expect(buildCmsMetadata(defaults, undefined).robots).toBeUndefined();
  });
});
