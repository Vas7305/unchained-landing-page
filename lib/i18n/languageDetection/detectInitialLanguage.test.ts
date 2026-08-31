import { describe, expect, it } from 'vitest';
import { locales } from '../config';
import {
  detectInitialLanguage,
  detectLanguage,
} from './detectInitialLanguage';
import { countryLanguages, countryToLanguage } from './countryLanguage';
import { normalizeBrowserLanguage, pickBrowserLanguage } from './browserLanguage';

describe('detectInitialLanguage', () => {
  it('keeps a saved preference over country and browser', () => {
    expect(
      detectInitialLanguage({
        savedLocale: 'ru',
        browserLanguages: ['en-US'],
        country: 'US',
      }),
    ).toBe('ru');
  });

  it('prefers the browser language over the country', () => {
    expect(
      detectInitialLanguage({
        savedLocale: null,
        browserLanguages: ['es-ES'],
        country: 'US',
      }),
    ).toBe('es');
  });

  it('falls back to the country when no browser language is supported', () => {
    expect(
      detectInitialLanguage({
        savedLocale: null,
        browserLanguages: ['ja-JP'],
        country: 'RU',
      }),
    ).toBe('ru');
  });

  it('falls back to English when neither signal resolves', () => {
    expect(
      detectInitialLanguage({
        savedLocale: null,
        browserLanguages: ['ja-JP'],
        country: 'JP',
      }),
    ).toBe('en');
  });

  it('falls back to English for an unsupported browser language', () => {
    expect(
      detectInitialLanguage({
        browserLanguages: ['pt-BR'],
        country: 'US',
      }),
    ).toBe('en');
  });

  it('reports which signal decided', () => {
    expect(detectLanguage({ savedLocale: 'de' }).source).toBe('saved');
    expect(detectLanguage({ browserLanguages: ['fr-FR'] }).source).toBe(
      'browser',
    );
    expect(detectLanguage({ country: 'IT' }).source).toBe('country');
    expect(detectLanguage({}).source).toBe('default');
  });

  it('ignores a saved value that is not a supported locale', () => {
    expect(
      detectInitialLanguage({ savedLocale: 'pt', browserLanguages: ['de-DE'] }),
    ).toBe('de');
    expect(detectInitialLanguage({ savedLocale: '', country: 'IT' })).toBe('it');
  });

  it('walks the browser list in order of preference', () => {
    expect(
      detectInitialLanguage({ browserLanguages: ['ja', 'pt-BR', 'fr-CA', 'de'] }),
    ).toBe('fr');
  });

  it('works with no signals at all', () => {
    expect(detectInitialLanguage({})).toBe('en');
    expect(
      detectInitialLanguage({
        savedLocale: null,
        browserLanguages: null,
        country: null,
      }),
    ).toBe('en');
  });

  // The scenarios spelled out in the brief: location is not language.
  it.each([
    ['RU', 'ru-RU', 'ru'],
    ['RU', 'en-US', 'en'],
    ['IT', 'it-IT', 'it'],
    ['IT', 'en-US', 'en'],
    ['US', 'es-ES', 'es'],
  ])('country %s + browser %s → %s', (country, browser, expected) => {
    expect(
      detectInitialLanguage({ browserLanguages: [browser], country }),
    ).toBe(expected);
  });
});

describe('normalizeBrowserLanguage', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['es-US', 'es'],
    ['es-ES', 'es'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['it-IT', 'it'],
    ['fr-FR', 'fr'],
    ['de-DE', 'de'],
    ['de-AT', 'de'],
    ['ru-RU', 'ru'],
    ['ru-UA', 'ru'],
    ['RU', 'ru'],
  ])('%s → %s', (tag, expected) => {
    expect(normalizeBrowserLanguage(tag)).toBe(expected);
  });

  it.each(['pt-BR', 'ja-JP', 'zh-Hant', 'nl', '', '*'])(
    'ignores the unsupported tag %s',
    (tag) => {
      expect(normalizeBrowserLanguage(tag)).toBeNull();
    },
  );

  it('ignores nullish tags', () => {
    expect(normalizeBrowserLanguage(null)).toBeNull();
    expect(normalizeBrowserLanguage(undefined)).toBeNull();
    expect(pickBrowserLanguage(null)).toBeNull();
    expect(pickBrowserLanguage([])).toBeNull();
  });
});

describe('countryToLanguage', () => {
  it.each([
    ['US', 'en'],
    ['IE', 'en'],
    ['MX', 'es'],
    ['NI', 'es'],
    ['IT', 'it'],
    ['BE', 'fr'],
    ['CH', 'de'],
    ['KZ', 'ru'],
  ])('%s → %s', (country, expected) => {
    expect(countryToLanguage(country)).toBe(expected);
  });

  it('accepts lowercase and padded codes', () => {
    expect(countryToLanguage('ru')).toBe('ru');
    expect(countryToLanguage(' fr ')).toBe('fr');
  });

  it('returns null for unmapped or malformed input', () => {
    for (const value of ['JP', 'ZZ', 'XX', 'U', '', null, undefined]) {
      expect(countryToLanguage(value)).toBeNull();
    }
  });

  it('only ever maps onto a supported locale', () => {
    const supported = new Set<string>(locales.map((l) => l.code));
    for (const language of Object.values(countryLanguages)) {
      expect(supported.has(language)).toBe(true);
    }
  });
});
