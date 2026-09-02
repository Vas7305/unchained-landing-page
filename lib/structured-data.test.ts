import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_ID,
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  serializeJsonLd,
} from './structured-data';
import { englishFaqEntries, faqItems } from './faq';
import { SITE_OG_IMAGE, absoluteUrl } from './metadata';
import { siteConfig } from './site';
import { en } from './i18n/dictionaries/en';
import type { InsightArticle } from './insights';

function article(overrides: Partial<InsightArticle> = {}): InsightArticle {
  return {
    slug: 'fixture-article',
    title: 'Fixture Article',
    description: 'A fixture used by the tests.',
    lede: 'A fixture used by the tests.',
    publishedAt: '2026-01-15',
    pillar: 'software-development',
    sections: [{ heading: 'Fixture', body: ['Fixture paragraph.'] }],
    ...overrides,
  };
}

describe('organizationSchema', () => {
  const org = organizationSchema();

  it('identifies the company by its full name', () => {
    expect(org.name).toBe('Unchained Business');
    // "Unchained" alone names several unrelated companies; the entity has to
    // be unambiguous.
    expect(org.name).not.toBe('Unchained');
  });

  it('claims the canonical website as the organization URL', () => {
    expect(org.url).toBe('https://www.unchainedbusiness.com/');
    expect(org.url).toBe(absoluteUrl('/'));
  });

  it('has one stable @id, derived from the site config', () => {
    expect(org['@id']).toBe(`${siteConfig.url}/#organization`);
    expect(ORGANIZATION_ID).toBe(org['@id']);
    // Same object every call: nothing here is time- or request-dependent.
    expect(organizationSchema()).toEqual(org);
  });

  it('is a valid, typed JSON-LD node', () => {
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
  });

  it('points at the logo the site actually renders', () => {
    expect(org.logo).toBe(absoluteUrl('/unchained-business-logo.png'));
  });

  it('claims nothing the site cannot show', () => {
    // The guard against schema drifting into invention: any new property has
    // to be added here deliberately, with something on the site behind it.
    expect(Object.keys(org).sort()).toEqual([
      '@context',
      '@id',
      '@type',
      'description',
      'logo',
      'name',
      'url',
    ]);
    for (const invented of [
      'sameAs',
      'foundingDate',
      'numberOfEmployees',
      'award',
      'aggregateRating',
      'review',
      'address',
      'employee',
      'founder',
    ]) {
      expect(org[invented]).toBeUndefined();
    }
  });
});

describe('breadcrumbSchema', () => {
  const crumbs = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Insights', path: '/insights' },
    { name: 'Fixture Article', path: '/insights/fixture-article' },
  ]);
  const items = crumbs.itemListElement as Record<string, unknown>[];

  it('is a BreadcrumbList', () => {
    expect(crumbs['@context']).toBe('https://schema.org');
    expect(crumbs['@type']).toBe('BreadcrumbList');
  });

  it('numbers the trail from the home page down, in order', () => {
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.name)).toEqual([
      'Home',
      'Insights',
      'Fixture Article',
    ]);
  });

  it('gives every step an absolute URL on the canonical host', () => {
    expect(items.map((i) => i.item)).toEqual([
      `${siteConfig.url}/`,
      `${siteConfig.url}/insights`,
      `${siteConfig.url}/insights/fixture-article`,
    ]);
  });

  it('types every step as a ListItem', () => {
    expect(items.every((i) => i['@type'] === 'ListItem')).toBe(true);
  });

  it('describes a two-step trail just as happily', () => {
    const shallow = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Software Development', path: '/software-development' },
    ]);
    expect((shallow.itemListElement as unknown[]).length).toBe(2);
  });
});

describe('articleSchema', () => {
  const schema = articleSchema(
    article({ slug: 'custom-software-or-saas', updatedAt: '2026-02-01' }),
  );
  const url = `${siteConfig.url}/insights/custom-software-or-saas`;

  it('is an Article built from the article own fields', () => {
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe('Fixture Article');
    expect(schema.description).toBe('A fixture used by the tests.');
  });

  it('points at the article URL, and calls that page its main entity', () => {
    expect(schema.url).toBe(url);
    expect(schema['@id']).toBe(`${url}#article`);
    expect(schema.mainEntityOfPage).toEqual({
      '@type': 'WebPage',
      '@id': url,
    });
  });

  it('dates the article from publishedAt and updatedAt', () => {
    expect(schema.datePublished).toBe('2026-01-15');
    expect(schema.dateModified).toBe('2026-02-01');
  });

  it('treats an unrevised article as last modified when it was published', () => {
    const unrevised = articleSchema(article());
    expect(unrevised.datePublished).toBe('2026-01-15');
    expect(unrevised.dateModified).toBe('2026-01-15');
  });

  it('uses the same image the page metadata does', () => {
    // No image of its own: the site image, absolute.
    expect(schema.image).toBe(absoluteUrl(SITE_OG_IMAGE));
    const withOwn = articleSchema(article({ ogImage: '/insights/own.png' }));
    expect(withOwn.image).toBe(absoluteUrl('/insights/own.png'));
  });

  it('publishes under the site one Organization, and invents no author', () => {
    expect(schema.publisher).toMatchObject({
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Unchained Business',
    });
    // Module 2 has no author model; the organization writes these, and no
    // person or "editorial team" is fabricated to fill the property.
    expect(schema.author).toEqual(schema.publisher);
  });

  it('does not describe a second organization', () => {
    const publisher = schema.publisher as Record<string, unknown>;
    const author = schema.author as Record<string, unknown>;
    expect(publisher['@id']).toBe(organizationSchema()['@id']);
    expect(author['@id']).toBe(organizationSchema()['@id']);
  });
});

describe('faqPageSchema', () => {
  it('describes the questions the homepage actually publishes', () => {
    const entries = englishFaqEntries();
    expect(entries).toHaveLength(faqItems.length);
    expect(entries[0]).toEqual({ question: en['faq.q1'], answer: en['faq.a1'] });
    // Real, substantial answers — not stubs written to obtain a schema.
    for (const entry of entries) {
      expect(entry.question.length).toBeGreaterThan(10);
      expect(entry.answer.length).toBeGreaterThan(40);
    }
  });

  it('maps each entry onto a Question with an accepted Answer', () => {
    const schema = faqPageSchema([{ question: 'Q?', answer: 'A.' }]);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Q?',
        acceptedAnswer: { '@type': 'Answer', text: 'A.' },
      },
    ]);
  });
});

describe('serializeJsonLd', () => {
  it('produces JSON that parses back unchanged', () => {
    const data = organizationSchema();
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('cannot close the script element it is embedded in', () => {
    const out = serializeJsonLd({
      '@type': 'Thing',
      name: '</script><script>alert(1)</script>',
    });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    // Still the original string once parsed.
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });

  it('escapes ampersands too, so no HTML entity can form', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: 'R&D' });
    expect(out).not.toContain('&');
    expect(JSON.parse(out).name).toBe('R&D');
  });
});
