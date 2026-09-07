import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProjects, toProject } from './portfolio';
import { fallbackProjects } from './projects';

/**
 * The website's half of the contract in
 * supabase/migrations/20260907000002_unchained_projects.sql.
 *
 * These tests deliberately do NOT test what the portfolio contains. Which
 * projects are public is `WHERE p.published` inside list_public_projects(),
 * and it is pinned by that migration's own apply-time assertions. What is
 * tested here is everything this repository is responsible for: that a hostile
 * or broken row can never reach the page, that a failure of any kind still
 * leaves a portfolio on screen, and — the one that is easy to get backwards —
 * that an empty ANSWER is respected while an empty FAILURE is not.
 */

/** A row as the RPC returns it: snake_case, every field present. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'a-project',
    title: 'A Project',
    description: 'What it is.',
    category: 'Portfolio Website',
    status: 'in-development',
    featured: false,
    detailed: false,
    year: 2026,
    industry: 'Beauty & editorial',
    services: [],
    technologies: [],
    capabilities: [],
    thumbnail: '/work/a-project.webp',
    thumbnail_width: null,
    thumbnail_height: null,
    hero_image: null,
    summary: null,
    challenge: null,
    solution: null,
    outcome: null,
    external_url: null,
    ...overrides,
  };
}

describe('toProject', () => {
  it('maps a row to the model the components are written against', () => {
    const project = toProject(
      row({
        services: ['Product design', 'Full-stack development'],
        thumbnail_width: 747,
        thumbnail_height: 546,
      }),
    );

    expect(project).toMatchObject({
      slug: 'a-project',
      title: 'A Project',
      category: 'Portfolio Website',
      status: 'in-development',
      // The model states the year as a string; the column is a SMALLINT.
      year: '2026',
      services: ['Product design', 'Full-stack development'],
      thumbnailSize: { width: 747, height: 546 },
    });
  });

  it('drops a row that could not be rendered as a card', () => {
    // Each of the four is required because every surface uses it. A row
    // missing one is dropped rather than filled in — inventing a category
    // would put a word on the website that nobody wrote.
    expect(toProject(row({ slug: null }))).toBeNull();
    expect(toProject(row({ title: '   ' }))).toBeNull();
    expect(toProject(row({ description: 42 }))).toBeNull();
    expect(toProject(row({ category: undefined }))).toBeNull();
    expect(toProject(null)).toBeNull();
  });

  it('refuses a slug that is not a URL segment', () => {
    // A slug reaches the page as /work/<slug>. One needing escaping would
    // produce a link that does not resolve to the page it names.
    expect(toProject(row({ slug: 'Not A Slug' }))).toBeNull();
    expect(toProject(row({ slug: '../etc' }))).toBeNull();
    expect(toProject(row({ slug: 'trailing-' }))).toBeNull();
  });

  it('strips characters that would rearrange the text on screen', () => {
    const project = toProject(
      row({ title: 'A\u202EProject\u200B', category: 'Web  site' }),
    );

    expect(project?.title).toBe('A Project');
    expect(project?.category).toBe('Web site');
  });

  it('keeps the paragraphs of the prose the detail page renders', () => {
    const project = toProject(
      row({
        summary: 'First line.\nSecond line.',
        challenge: 'The problem.',
        solution: 'What was built.',
        detailed: true,
      }),
    );

    // The single-line fields collapse their whitespace; these do not, because
    // somebody may have written them in paragraphs.
    expect(project?.summary).toBe('First line.\nSecond line.');
  });

  it('degrades a bad image to no image rather than losing the project', () => {
    const offSite = toProject(row({ thumbnail: 'https://example.com/x.webp' }));
    expect(offSite).not.toBeNull();
    expect(offSite?.thumbnail).toBeUndefined();

    // Protocol-relative: it starts with a slash and points at another host.
    expect(toProject(row({ thumbnail: '//evil.example/x.webp' }))?.thumbnail)
      .toBeUndefined();
  });

  it('keeps a thumbnail size only alongside the image it measures', () => {
    expect(
      toProject(row({ thumbnail_width: 747, thumbnail_height: null }))
        ?.thumbnailSize,
    ).toBeUndefined();

    expect(
      toProject(row({ thumbnail: null, thumbnail_width: 747, thumbnail_height: 546 }))
        ?.thumbnailSize,
    ).toBeUndefined();
  });

  it('falls back to a status the site can render', () => {
    // STATUS_META has no badge for 'shipped', so a card carrying it would draw
    // no status at all. The database refuses the value too; this is the second
    // wall, not the first.
    expect(toProject(row({ status: 'shipped' }))?.status).toBe('in-development');
    expect(toProject(row({ status: 'completed' }))?.status).toBe('completed');
  });

  it('refuses a detail page with nothing on it', () => {
    // `detailed` promises /work/<slug> renders three things. Without them the
    // honest answer is that there is no detail page, not a page of headings.
    const project = toProject(row({ detailed: true, summary: 'Only this.' }));
    expect(project?.detailed).toBe(false);
  });

  it('refuses a flagship that has no page to link to', () => {
    expect(toProject(row({ featured: true }))?.featured).toBe(false);
  });

  it('rejects an external link that is not an absolute http(s) URL', () => {
    expect(toProject(row({ external_url: 'tancercadeti.com' }))?.externalUrl)
      .toBeUndefined();
    expect(toProject(row({ external_url: 'javascript:alert(1)' }))?.externalUrl)
      .toBeUndefined();
    expect(toProject(row({ external_url: 'https://www.tancercadeti.com' }))?.externalUrl)
      .toBe('https://www.tancercadeti.com');
  });

  it('treats an out-of-range year as no year rather than as a date', () => {
    expect(toProject(row({ year: 1899 }))?.year).toBeUndefined();
    expect(toProject(row({ year: 'soon' }))?.year).toBeUndefined();
    expect(toProject(row({ year: null }))?.year).toBeUndefined();
  });

  it('drops empty list entries instead of rendering blank chips', () => {
    const project = toProject(row({ technologies: ['Next.js', '', '   ', 12] }));
    expect(project?.technologies).toEqual(['Next.js']);

    // An empty list is absent, not [], because the components render these
    // sections conditionally on the property being there.
    expect(toProject(row({ technologies: [] }))?.technologies).toBeUndefined();
  });
});

describe('loadProjects, with no database configured', () => {
  it('renders the portfolio compiled into the repository', async () => {
    // This suite sets no NEXT_PUBLIC_SUPABASE_* variables, which is the state
    // of a preview deploy and of a fresh checkout. An agency site with an
    // empty Our Work section says something false about the agency.
    await expect(loadProjects()).resolves.toEqual(fallbackProjects);
  });

  it('does not reach the network to find that out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await loadProjects();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * The configured path, with the module re-imported against stubbed variables.
 *
 * `projectsEndpoint` is resolved once at module load — the same shape
 * lib/commercial/config.ts uses — so the environment has to be in place before
 * the import, which is what resetModules() and the dynamic import below are
 * for.
 */
describe('loadProjects, with a database configured', () => {
  async function loadWith(
    responder: () => Promise<Response> | Response,
  ): Promise<Awaited<ReturnType<typeof loadProjects>>> {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn(responder));
    vi.resetModules();

    const portfolio = await import('./portfolio');
    return portfolio.loadProjects();
  }

  function json(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('renders what the database answered', async () => {
    const projects = await loadWith(() =>
      json([row({ slug: 'frito', title: 'Frito' })]),
    );

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ slug: 'frito', title: 'Frito' });
  });

  it('respects an empty portfolio, because that is an answer', async () => {
    // The rule most easily got backwards. Falling back here would mean the
    // panel can add a project and can edit one, but can never remove the last
    // one — the site would resurrect it, and no amount of looking at the panel
    // would explain why.
    await expect(loadWith(() => json([]))).resolves.toEqual([]);
  });

  it('falls back when the request fails in any way', async () => {
    await expect(
      loadWith(() => json({ message: 'nope' }, { status: 500 })),
    ).resolves.toEqual(fallbackProjects);

    await expect(
      loadWith(() => {
        throw new Error('ECONNREFUSED');
      }),
    ).resolves.toEqual(fallbackProjects);

    await expect(
      loadWith(() => new Response('not json', { status: 200 })),
    ).resolves.toEqual(fallbackProjects);

    // PostgREST answering with an error object rather than a list of rows.
    await expect(
      loadWith(() => json({ code: 'PGRST202', message: 'no function' })),
    ).resolves.toEqual(fallbackProjects);
  });

  it('falls back when rows arrived but none could be rendered', async () => {
    // Distinct from the empty answer above: the database said something this
    // site cannot read, which is a failure like any other.
    await expect(
      loadWith(() => json([row({ slug: null }), row({ title: '' })])),
    ).resolves.toEqual(fallbackProjects);
  });

  it('never lets a second project claim a slug or the flagship', async () => {
    // Both are impossible in the table — a UNIQUE column and a partial unique
    // index. Decided here as well so the answer is the same whatever the site
    // is reading: two rows on one slug would give /work/<slug> two candidate
    // pages, and two flagships would make the homepage depend on ordering.
    const detailed = {
      detailed: true,
      summary: 'Summary.',
      challenge: 'Challenge.',
      solution: 'Solution.',
    };

    const projects = await loadWith(() =>
      json([
        row({ slug: 'one', featured: true, ...detailed }),
        row({ slug: 'two', featured: true, ...detailed }),
        row({ slug: 'one', title: 'Duplicate' }),
      ]),
    );

    expect(projects.map((p) => p.slug)).toEqual(['one', 'two']);
    expect(projects.filter((p) => p.featured).map((p) => p.slug)).toEqual(['one']);
  });

  it('asks the one function it is allowed to call, with no arguments', async () => {
    const fetchSpy = vi.fn(() => json([]));
    await loadWith(fetchSpy);

    // vi.fn() infers the zero-argument responder's signature, not fetch's,
    // so the recorded call has to be read back at fetch's shape.
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://project.supabase.co/rest/v1/rpc/list_public_projects',
    );
    expect(init.method).toBe('POST');
    // No predicate, no slug, no `published` flag: there is no filter for a
    // caller to influence, which is what makes the anon grant safe.
    expect(init.body).toBe('{}');
  });
});
