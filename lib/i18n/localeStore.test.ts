import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_STORAGE_KEY } from './config';

/**
 * The store caches its answer in module scope — the same thing that keeps
 * `useSyncExternalStore` happy — so every test re-imports it to stand in for a
 * fresh page load.
 */
async function loadStore() {
  vi.resetModules();
  return import('./localeStore');
}

function fakeStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    entries,
  };
}

type Visit = {
  stored?: Record<string, string>;
  languages?: string[];
  /** Body Cloudflare's `/cdn-cgi/trace` responds with, if it responds at all. */
  trace?: string;
};

function visit({ stored = {}, languages = ['en-US'], trace }: Visit = {}) {
  const storage = fakeStorage(stored);
  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('navigator', { languages, language: languages[0] });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      trace === undefined
        ? { ok: false, headers: { get: () => null }, text: async () => '' }
        : {
            ok: true,
            headers: { get: () => 'text/plain' },
            text: async () => trace,
          },
    ),
  );
  return storage;
}

/** Lets the memoised `/cdn-cgi/trace` promise settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('first visit', () => {
  it('uses the browser language and stores nothing', async () => {
    const storage = visit({ languages: ['ru-RU', 'en-US'] });
    const store = await loadStore();

    expect(store.getSnapshot()).toBe('ru');
    // Detection is a guess, not a choice — it must not look explicit later.
    expect(storage.entries.has(LOCALE_STORAGE_KEY)).toBe(false);
  });

  it('still renders the prerendered default on the server', async () => {
    visit({ languages: ['ru-RU'] });
    const store = await loadStore();

    expect(store.getServerSnapshot()).toBe('en');
  });

  it('falls back to English when no browser language is supported', async () => {
    visit({ languages: ['ja-JP'] });
    const store = await loadStore();

    expect(store.getSnapshot()).toBe('en');
  });
});

describe('returning visit', () => {
  it('keeps an explicit choice over browser and country', async () => {
    visit({
      stored: { [LOCALE_STORAGE_KEY]: 'en' },
      languages: ['ru-RU'],
      trace: 'loc=RU\n',
    });
    const store = await loadStore();
    store.subscribe(vi.fn());
    await settle();

    expect(store.getSnapshot()).toBe('en');
  });

  it('ignores a stored value that is no longer a supported locale', async () => {
    visit({ stored: { [LOCALE_STORAGE_KEY]: 'pt' }, languages: ['de-DE'] });
    const store = await loadStore();

    expect(store.getSnapshot()).toBe('de');
  });
});

describe('manual selection', () => {
  it('persists the choice and survives the next visit', async () => {
    const first = visit({ languages: ['ru-RU'] });
    const store = await loadStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getSnapshot()).toBe('ru');
    store.setLocale('en');
    expect(store.getSnapshot()).toBe('en');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(first.entries.get(LOCALE_STORAGE_KEY)).toBe('en');

    // Same visitor, same Russian browser, next visit.
    visit({
      stored: Object.fromEntries(first.entries),
      languages: ['ru-RU'],
      trace: 'loc=RU\n',
    });
    const next = await loadStore();
    next.subscribe(vi.fn());
    await settle();

    expect(next.getSnapshot()).toBe('en');
  });

  it('records a pick that matches the detected language', async () => {
    const storage = visit({ languages: ['ru-RU'] });
    const store = await loadStore();

    store.setLocale('ru');

    expect(storage.entries.get(LOCALE_STORAGE_KEY)).toBe('ru');
  });

  it('survives blocked storage', async () => {
    visit({ languages: ['fr-FR'] });
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const store = await loadStore();

    expect(store.getSnapshot()).toBe('fr');
    expect(() => store.setLocale('de')).not.toThrow();
    expect(store.getSnapshot()).toBe('de');
  });
});

describe('country inference', () => {
  it('resolves the language from the edge when the browser offers none', async () => {
    visit({ languages: ['ja-JP'], trace: 'fl=1a\nloc=RU\nvisit_scheme=https\n' });
    const store = await loadStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getSnapshot()).toBe('en');
    await settle();

    expect(store.getSnapshot()).toBe('ru');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stays on English when the country maps to nothing', async () => {
    visit({ languages: ['ja-JP'], trace: 'loc=JP\n' });
    const store = await loadStore();
    store.subscribe(vi.fn());
    await settle();

    expect(store.getSnapshot()).toBe('en');
  });

  it('stays on English when there is no edge to ask', async () => {
    visit({ languages: ['ja-JP'] });
    const store = await loadStore();
    store.subscribe(vi.fn());
    await settle();

    expect(store.getSnapshot()).toBe('en');
  });

  it('never looks a country up when the browser already answered', async () => {
    visit({ languages: ['it-IT'], trace: 'loc=RU\n' });
    const store = await loadStore();
    store.subscribe(vi.fn());
    await settle();

    expect(store.getSnapshot()).toBe('it');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loses to a manual pick made while the lookup is in flight', async () => {
    visit({ languages: ['ja-JP'], trace: 'loc=RU\n' });
    const store = await loadStore();
    store.subscribe(vi.fn());

    store.setLocale('de');
    await settle();

    expect(store.getSnapshot()).toBe('de');
  });
});
