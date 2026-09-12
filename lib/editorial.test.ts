import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadInsights, toInsight } from './editorial';
import { publishedInsights } from './insights';

/**
 * The editorial loader: what it accepts from the database, what it refuses,
 * and when it falls back to the collection in lib/insights.ts.
 *
 * The same shape as lib/portfolio.test.ts, because the two modules are the
 * same shape — and the cases that matter are the ones where the two must
 * behave identically, since a difference between them is a bug nobody would
 * look for.
 */

/** A row the loader should accept, as PostgREST would serialise it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'a-published-article',
    title: 'A Published Article',
    description: 'What the index card and the meta description say.',
    lede: 'The opening line.',
    pillar: 'software-development',
    sections: [{ heading: 'A heading', body: ['A paragraph.'] }],
    published_on: '2026-09-02',
    related_slugs: [],
    tags: [],
    translations: {},
    ...overrides,
  };
}

describe('toInsight', () => {
  it('reads a well-formed row', () => {
    const article = toInsight(row());

    expect(article).not.toBeNull();
    expect(article!.slug).toBe('a-published-article');
    expect(article!.publishedAt).toBe('2026-09-02');
    expect(article!.sections).toHaveLength(1);
  });

  it('refuses a row with no slug, or a slug that is not one', () => {
    expect(toInsight(row({ slug: null }))).toBeNull();
    expect(toInsight(row({ slug: 'Not A Slug' }))).toBeNull();
    expect(toInsight(row({ slug: '/insights/escape' }))).toBeNull();
  });

  it('refuses a pillar the site has no page for', () => {
    // Filing an article under a pillar with no page would render a breadcrumb
    // link to a 404.
    expect(toInsight(row({ pillar: 'quantum-computing' }))).toBeNull();
  });

  it('refuses a date that is not a calendar day', () => {
    expect(toInsight(row({ published_on: '2026-02-31' }))).toBeNull();
    expect(toInsight(row({ published_on: '02/09/2026' }))).toBeNull();
  });

  it('refuses a published row with no body', () => {
    expect(toInsight(row({ sections: [] }))).toBeNull();
    expect(toInsight(row({ sections: null }))).toBeNull();
  });

  it('drops a malformed section rather than repairing it', () => {
    const article = toInsight(
      row({
        sections: [
          { heading: 'Kept', body: ['Has a paragraph.'] },
          { heading: 'No body', body: [] },
          { body: ['No heading.'] },
          'not an object',
        ],
      }),
    );

    expect(article!.sections).toHaveLength(1);
    expect(article!.sections[0].heading).toBe('Kept');
  });

  it('keeps paragraph breaks inside prose and flattens them in labels', () => {
    const article = toInsight(
      row({
        sections: [
          {
            heading: 'A  spaced   heading',
            body: ['First line.\nSecond line.'],
          },
        ],
      }),
    );

    expect(article!.sections[0].heading).toBe('A spaced heading');
    expect(article!.sections[0].body[0]).toBe('First line.\nSecond line.');
  });

  it('falls back to the description when there is no lede', () => {
    const article = toInsight(row({ lede: null }));
    expect(article!.lede).toBe(
      'What the index card and the meta description say.',
    );
  });

  describe('an image', () => {
    it('is accepted as a site path or a CMS bucket object', () => {
      expect(toInsight(row({ cover_image: '/insights/cover.webp' }))!.coverImage)
        .toBe('/insights/cover.webp');

      const bucket =
        'https://abcdefghijklm.supabase.co/storage/v1/object/public/unchained-cms-media/a.webp';
      expect(toInsight(row({ cover_image: bucket }))!.coverImage).toBe(bucket);
    });

    it('is dropped when it is on a host we do not control', () => {
      expect(
        toInsight(row({ cover_image: 'https://example.com/a.png' }))!.coverImage,
      ).toBeUndefined();
      expect(
        toInsight(row({ cover_image: '//evil.example/a.png' }))!.coverImage,
      ).toBeUndefined();
    });

    it('carries no alt text when there is no image to describe', () => {
      const article = toInsight(row({ cover_image_alt: 'An orphan.' }));
      expect(article!.coverImageAlt).toBeUndefined();
    });
  });

  describe('translations', () => {
    it('reads the locales the site was built with', () => {
      const article = toInsight(
        row({
          translations: {
            es: { title: 'Un artículo publicado', description: 'La tarjeta.' },
          },
        }),
      );

      expect(article!.translations?.es?.title).toBe('Un artículo publicado');
    });

    it('drops a locale the site has no dictionary for', () => {
      const article = toInsight(
        row({ translations: { ja: { title: '公開された記事' } } }),
      );

      expect(article!.translations).toBeUndefined();
    });

    it('keeps an untranslated field absent rather than null', () => {
      const article = toInsight(
        row({ translations: { fr: { title: 'Un article' } } }),
      );

      expect(article!.translations?.fr).toEqual({ title: 'Un article' });
      expect('description' in article!.translations!.fr!).toBe(false);
    });
  });

  describe('draft mode', () => {
    it('renders an article that has no date and no body yet', () => {
      // What a draft looks like on the morning somebody starts writing it. The
      // database allows exactly this; only PUBLISHING requires the two fields.
      const draft = toInsight(
        row({ published_on: null, sections: [] }),
        { draft: true },
      );

      expect(draft).not.toBeNull();
      expect(draft!.sections).toEqual([]);
      expect(draft!.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('still refuses what cannot be laid out at all', () => {
      expect(toInsight(row({ title: null }), { draft: true })).toBeNull();
      expect(toInsight(row({ pillar: null }), { draft: true })).toBeNull();
    });

    it('is not reachable from the public loader', () => {
      // The public path must never relax the publication requirements. Stated
      // as a test because the flag is one argument away from being passed.
      expect(toInsight(row({ published_on: null, sections: [] }))).toBeNull();
    });
  });
});

describe('loadInsights, with no database configured', () => {
  // This suite runs with no NEXT_PUBLIC_SUPABASE_URL, so rpcEndpoint() is null
  // and the loader never makes a request.
  it('serves the collection in lib/insights.ts', async () => {
    await expect(loadInsights()).resolves.toEqual(publishedInsights);
  });
});

describe('loadInsights, with a database configured', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /**
   * Re-import the module with the environment set, so `rpcEndpoint` resolves.
   * The endpoint is computed at module scope — deliberately, so the site
   * decides once whether it has a database — which means a test that wants one
   * has to load the module again.
   */
  async function withDatabase(fetchImpl: typeof fetch) {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', fetchImpl);
    vi.resetModules();
    return (await import('./editorial')).loadInsights;
  }

  function respond(body: unknown, ok = true): typeof fetch {
    return (async () =>
      ({
        ok,
        json: async () => body,
      }) as unknown as Response) as unknown as typeof fetch;
  }

  it('reads the rows it is given', async () => {
    const load = await withDatabase(respond([row()]));
    const articles = await load();

    expect(articles).toHaveLength(1);
    expect(articles[0].slug).toBe('a-published-article');
  });

  it('respects an empty answer instead of resurrecting the fallback', async () => {
    // A successful call returning nothing is an ANSWER: the editor archived
    // the last article. Falling back here would mean the site brings it back
    // and nothing in the panel explains why.
    const load = await withDatabase(respond([]));
    await expect(load()).resolves.toEqual([]);
  });

  it('falls back when the request fails', async () => {
    const load = await withDatabase(respond(null, false));
    const articles = await load();
    expect(articles.map((a) => a.slug)).toEqual(
      publishedInsights.map((a) => a.slug),
    );
  });

  it('falls back when the answer is not a list', async () => {
    const load = await withDatabase(respond({ message: 'nope' }));
    const articles = await load();
    expect(articles).toHaveLength(publishedInsights.length);
  });

  it('falls back when every row that arrived was unreadable', async () => {
    const load = await withDatabase(respond([{ slug: null }, { slug: null }]));
    const articles = await load();
    expect(articles).toHaveLength(publishedInsights.length);
  });

  it('never throws, whatever the network does', async () => {
    const load = await withDatabase((() => {
      throw new Error('offline');
    }) as unknown as typeof fetch);

    await expect(load()).resolves.toBeInstanceOf(Array);
  });

  it('keeps one article per slug', async () => {
    const load = await withDatabase(
      respond([row(), row({ title: 'A duplicate' })]),
    );
    const articles = await load();

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('A Published Article');
  });
});
