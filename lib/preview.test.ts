import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The preview boundary.
 *
 * What is being checked here is NOT that a valid token works — the database
 * decides that, and supabase/migrations/20260912000004 exercises it at apply
 * time against a real row. What is checked here is the site's half: that a
 * request is not even made for something that cannot be a token, that every
 * failure looks identical from the outside, and that the preview path is
 * separate from the public one.
 */

const VALID = 'a'.repeat(64);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function withDatabase(fetchImpl: typeof fetch) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubGlobal('fetch', fetchImpl);
  vi.resetModules();
  return import('./preview');
}

function respond(body: unknown, ok = true): typeof fetch {
  return (async () =>
    ({ ok, json: async () => body }) as unknown as Response) as unknown as typeof fetch;
}

describe('a token that cannot be one', () => {
  it('is refused without a request being made', async () => {
    const fetchSpy = vi.fn();
    const { loadPreviewProject, loadPreviewInsight } =
      await withDatabase(fetchSpy as unknown as typeof fetch);

    for (const bad of [
      undefined,
      null,
      '',
      'preview',
      'a'.repeat(63), // one short
      'a'.repeat(65), // one long
      'A'.repeat(64), // upper case — issue_preview_token mints lower
      'g'.repeat(64), // not hex
      ['a'.repeat(64)], // an array, as Next gives for a repeated parameter
      1,
    ]) {
      await expect(loadPreviewProject(bad)).resolves.toBeNull();
      await expect(loadPreviewInsight(bad)).resolves.toBeNull();
    }

    // The point: a crawler appending junk, or somebody guessing, costs this
    // site nothing and never reaches the database.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('a well-formed token the database does not recognise', () => {
  it('returns nothing, the same as every other failure', async () => {
    // preview_project() returns zero rows for an unknown, expired, revoked or
    // wrong-type token. They are deliberately indistinguishable — telling the
    // holder WHICH it was would confirm a token had once been real.
    const { loadPreviewProject } = await withDatabase(respond([]));
    await expect(loadPreviewProject(VALID)).resolves.toBeNull();
  });

  it('returns nothing when the request itself fails', async () => {
    const { loadPreviewProject } = await withDatabase(respond(null, false));
    await expect(loadPreviewProject(VALID)).resolves.toBeNull();
  });

  it('returns nothing, rather than throwing, when the network does', async () => {
    const { loadPreviewProject } = await withDatabase((() => {
      throw new Error('offline');
    }) as unknown as typeof fetch);

    await expect(loadPreviewProject(VALID)).resolves.toBeNull();
  });
});

describe('with no database configured', () => {
  it('previews nothing rather than falling back to published content', async () => {
    // The public loaders fall back to the collections in the repository when
    // there is no database. A preview must NOT: there is no offline answer to
    // the question "what does this unpublished draft look like", and returning
    // a published project instead would show the editor the wrong page.
    vi.resetModules();
    const { loadPreviewProject, loadPreviewInsight } = await import('./preview');

    await expect(loadPreviewProject(VALID)).resolves.toBeNull();
    await expect(loadPreviewInsight(VALID)).resolves.toBeNull();
  });
});

describe('a token the database honours', () => {
  const draftRow = {
    slug: 'an-unannounced-project',
    title: 'An Unannounced Project',
    description: 'Not on the site yet.',
    category: 'Marketplace Platform',
    status: 'in-development',
    published: false,
    archived: false,
    preview_locale: 'de',
  };

  it('returns the draft and says it is one', async () => {
    const { loadPreviewProject } = await withDatabase(respond([draftRow]));
    const preview = await loadPreviewProject(VALID);

    expect(preview).not.toBeNull();
    expect(preview!.content.slug).toBe('an-unannounced-project');
    expect(preview!.state.published).toBe(false);
    expect(preview!.state.archived).toBe(false);
    expect(preview!.state.locale).toBe('de');
  });

  it('reports an archived item as archived', async () => {
    const { loadPreviewProject } = await withDatabase(
      respond([{ ...draftRow, archived: true }]),
    );
    const preview = await loadPreviewProject(VALID);
    expect(preview!.state.archived).toBe(true);
  });

  it('ignores a locale the site was not built with', async () => {
    const { loadPreviewProject } = await withDatabase(
      respond([{ ...draftRow, preview_locale: 'ja' }]),
    );
    const preview = await loadPreviewProject(VALID);
    expect(preview!.state.locale).toBeUndefined();
  });

  it('sends the token in the body, never in the URL', async () => {
    // A token in a query string ends up in access logs, in Referer headers and
    // in anything that records URLs. PostgREST takes RPC arguments in a POST
    // body; this asserts the site uses that.
    const calls: [string, RequestInit][] = [];
    const spy = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return { ok: true, json: async () => [draftRow] } as unknown as Response;
    }) as unknown as typeof fetch;

    const { loadPreviewProject } = await withDatabase(spy);
    await loadPreviewProject(VALID);

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).not.toContain(VALID);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ p_token: VALID });
  });

  it('is never cached', async () => {
    // A shared cache holding a draft, keyed by a URL containing its own token,
    // is the one place in this codebase where `no-store` is the correct answer.
    const calls: RequestInit[] = [];
    const spy = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return { ok: true, json: async () => [draftRow] } as unknown as Response;
    }) as unknown as typeof fetch;

    const { loadPreviewProject } = await withDatabase(spy);
    await loadPreviewProject(VALID);

    expect(calls[0].cache).toBe('no-store');
  });
});

describe('the public loaders', () => {
  it('have no code path that reaches a preview function', async () => {
    // Stated as a test because it is the property that makes the separation
    // worth having: lib/portfolio.ts and lib/editorial.ts must not be one
    // argument away from returning a draft.
    const portfolio = await import('./portfolio');
    const editorial = await import('./editorial');

    for (const name of Object.keys(portfolio).concat(Object.keys(editorial))) {
      expect(name).not.toMatch(/preview/i);
    }
  });
});
