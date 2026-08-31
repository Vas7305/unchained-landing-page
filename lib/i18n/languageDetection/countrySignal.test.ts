import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadSignal() {
  vi.resetModules();
  return import('./countrySignal');
}

/** Just enough DOM for the two lookups `readCountry` performs. */
function stubDocument(metas: Record<string, string>, cookie = '') {
  vi.stubGlobal('document', {
    cookie,
    querySelector: (selector: string) => {
      const name = /meta\[name="(.+)"\]/.exec(selector)?.[1];
      const content = name ? metas[name] : undefined;
      return content === undefined ? null : { getAttribute: () => content };
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readCountry', () => {
  it('returns null off the browser', async () => {
    const { readCountry } = await loadSignal();
    expect(readCountry()).toBeNull();
  });

  it('reads a Vercel country meta tag', async () => {
    vi.stubGlobal('window', {});
    stubDocument({ 'x-vercel-ip-country': 'RU' });
    const { readCountry } = await loadSignal();

    expect(readCountry()).toBe('RU');
  });

  it('reads a Cloudflare country meta tag', async () => {
    vi.stubGlobal('window', {});
    stubDocument({ 'cf-ipcountry': 'it' });
    const { readCountry } = await loadSignal();

    expect(readCountry()).toBe('IT');
  });

  it('prefers an injected global over the document', async () => {
    vi.stubGlobal('window', { __UNCHAINED_COUNTRY__: 'FR' });
    stubDocument({ 'cf-ipcountry': 'RU' });
    const { readCountry } = await loadSignal();

    expect(readCountry()).toBe('FR');
  });

  it('falls back to the country cookie', async () => {
    vi.stubGlobal('window', {});
    stubDocument({}, 'theme=dark; unchained.country=DE; other=1');
    const { readCountry } = await loadSignal();

    expect(readCountry()).toBe('DE');
  });

  it('rejects placeholder and malformed codes', async () => {
    vi.stubGlobal('window', {});
    stubDocument({ 'x-country': 'XX' });
    const { readCountry } = await loadSignal();
    expect(readCountry()).toBeNull();

    stubDocument({ 'x-country': 'Russia' });
    expect(readCountry()).toBeNull();
  });

  it('is null when the edge told us nothing', async () => {
    vi.stubGlobal('window', {});
    stubDocument({});
    const { readCountry } = await loadSignal();

    expect(readCountry()).toBeNull();
  });
});

describe('requestCountry', () => {
  it('parses `loc` out of a Cloudflare trace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: async () => 'fl=1a\nloc=RU\nvisit_scheme=https\n',
      })),
    );
    const { requestCountry } = await loadSignal();

    expect(await requestCountry()).toBe('RU');
  });

  it('asks at most once per page', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: async () => 'loc=DE\n',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { requestCountry } = await loadSignal();

    expect(await requestCountry()).toBe('DE');
    expect(await requestCountry()).toBe('DE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores an HTML 404 from a host that is not Cloudflare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        headers: { get: () => 'text/html' },
        text: async () => '<!doctype html>',
      })),
    );
    const { requestCountry } = await loadSignal();

    expect(await requestCountry()).toBeNull();
  });

  it('ignores a 200 that is not a trace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<!doctype html>',
      })),
    );
    const { requestCountry } = await loadSignal();

    expect(await requestCountry()).toBeNull();
  });

  it('swallows network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const { requestCountry } = await loadSignal();

    expect(await requestCountry()).toBeNull();
  });
});
