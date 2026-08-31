import { describe, expect, it } from 'vitest';
import { pickCountry, regionFromLocaleTags } from './countryDetection';

/**
 * §7 is a chain of trust, and the value of a chain is entirely in its order.
 * These tests pin that order, and — just as importantly — pin the signals that
 * must NOT be used, because the tempting mistake here is to add one.
 */

describe('regionFromLocaleTags', () => {
  it('reads the region subtag when the tag actually has one', () => {
    expect(regionFromLocaleTags(['en-GB'])).toBe('GB');
    expect(regionFromLocaleTags(['ru-RU'])).toBe('RU');
    expect(regionFromLocaleTags(['zh-Hans-CN'])).toBe('CN'); // script subtag
    expect(regionFromLocaleTags(['it-it'])).toBe('IT'); // case normalised
  });

  it('takes the first tag that carries a region, not the first tag', () => {
    expect(regionFromLocaleTags(['en', 'de-AT', 'fr-FR'])).toBe('AT');
  });

  it('infers nothing from a bare language (§7)', () => {
    // 'en' is a language, not a place. Treating it as US is exactly the
    // inference §7 forbids.
    expect(regionFromLocaleTags(['en'])).toBeNull();
    expect(regionFromLocaleTags(['ru', 'de', 'fr'])).toBeNull();
  });

  it('ignores UN M49 macro-regions, which are not countries', () => {
    expect(regionFromLocaleTags(['es-419'])).toBeNull();
  });

  it('is total: junk in, null out', () => {
    expect(regionFromLocaleTags([])).toBeNull();
    expect(regionFromLocaleTags(null)).toBeNull();
    expect(regionFromLocaleTags(undefined)).toBeNull();
    expect(regionFromLocaleTags(['', '-', 'not a tag'])).toBeNull();
    expect(regionFromLocaleTags([42 as unknown as string])).toBeNull();
  });
});

describe('pickCountry', () => {
  it('trusts the edge signal above everything else', () => {
    expect(
      pickCountry({ edge: 'RU', platform: 'DE', localeTags: ['en-US'] }),
    ).toEqual({ country: 'RU', source: 'edge' });
  });

  it('falls to the platform lookup when the document said nothing', () => {
    expect(
      pickCountry({ edge: null, platform: 'IT', localeTags: ['en-US'] }),
    ).toEqual({ country: 'IT', source: 'platform' });
  });

  it('falls to an explicit browser region only when both are silent', () => {
    expect(pickCountry({ localeTags: ['fr-FR', 'en'] })).toEqual({
      country: 'FR',
      source: 'locale',
    });
  });

  it('answers "no country" rather than inventing one (§23)', () => {
    // The visitor can still start a project from here; the resolver simply
    // decides on language and the global fallback.
    expect(pickCountry({})).toEqual({ country: null, source: 'none' });
    expect(
      pickCountry({ edge: null, platform: null, localeTags: ['en'] }),
    ).toEqual({ country: null, source: 'none' });
  });

  it('normalises case and whitespace from whatever wrote the signal', () => {
    expect(pickCountry({ edge: ' ru ' }).country).toBe('RU');
  });

  it('rejects placeholders and malformed codes at every level', () => {
    // 'XX' is the conventional unknown marker and is not a country; a signal
    // carrying it must fall through rather than be sent to the resolver.
    expect(pickCountry({ edge: 'XX', platform: 'ES' })).toEqual({
      country: 'ES',
      source: 'platform',
    });
    expect(pickCountry({ edge: 'RUS' }).country).toBeNull();
    expect(pickCountry({ edge: '1' }).country).toBeNull();
    expect(pickCountry({ edge: '' }).country).toBeNull();
  });
});
