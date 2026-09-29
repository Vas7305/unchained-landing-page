import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  getOffer,
  getShowcase,
  offerForProject,
  offers,
  publishedPrice,
  showcase,
  type Offer,
} from './offers';
import { fallbackProjects } from './projects';
import { hasDemo } from './demo/registry';
import { sourceCta } from './commercial/leads';
import { dictionaries } from './i18n/dictionaries';
import type { TranslationKey } from './i18n/dictionaries';

/**
 * The commercial layer's promises, as assertions.
 *
 * The one that matters most is the first: a price on this site is a public
 * commitment, and it must never reach the page without the scope and the
 * delivery time it buys. The rest keep the offers' links and attribution
 * pointing at things that exist.
 */

describe('prices', () => {
  it('never sets a starting price on an offer whose scope or delivery is undefined', () => {
    const unbacked = offers
      .filter((o) => o.startingPrice && (!o.includes || !o.delivery))
      .map((o) => o.id);

    expect(unbacked).toEqual([]);
  });

  it('withholds a price that has no scope behind it, whatever the data says', () => {
    const offer: Offer = {
      ...getOffer('a'),
      startingPrice: { amount: 1800, currency: 'USD' },
      includes: null,
      delivery: null,
    };
    expect(publishedPrice(offer)).toBeNull();
  });

  it('publishes a price once scope and delivery are both defined', () => {
    const offer: Offer = {
      ...getOffer('a'),
      startingPrice: { amount: 1800, currency: 'USD' },
      includes: 'svc.build.features',
      delivery: 'offers.timelineOnCall',
    };
    expect(publishedPrice(offer)).toEqual({ amount: 1800, currency: 'USD' });
  });

  it('publishes no price today — none has been confirmed', () => {
    // Update this deliberately, in the same commit that confirms a price.
    expect(offers.map(publishedPrice)).toEqual([null, null, null]);
  });

  it('formats whole amounts without decimals', () => {
    expect(formatPrice({ amount: 1800, currency: 'USD' }, 'en')).toBe('$1,800');
  });
});

describe('offers', () => {
  it('has three offers with unique ids', () => {
    expect(offers.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('links only to portfolio projects that have a demo', () => {
    for (const offer of offers) {
      for (const slug of offer.examples) {
        expect(
          fallbackProjects.some((p) => p.slug === slug),
          `${offer.id} → ${slug} is not in the portfolio`,
        ).toBe(true);
        expect(hasDemo(slug), `${offer.id} → ${slug} has no demo`).toBe(true);
      }
    }
  });

  it('gives every CTA a valid attribution label', () => {
    for (const offer of offers) {
      expect(sourceCta('offers', `offer_${offer.id}`)).toBe(`offers_offer_${offer.id}`);
    }
    expect(sourceCta('hero', 'offer_a')).toBe('hero_offer_a');
    for (const slug of Object.keys(showcase)) {
      expect(sourceCta('demo', slug)).toBe(`demo_${slug.replace(/-/g, '_')}`);
    }
  });
});

describe('showcase', () => {
  it('frames every project in the portfolio, and nothing else', () => {
    expect(Object.keys(showcase).sort()).toEqual(
      fallbackProjects.map((p) => p.slug).sort(),
    );
  });

  it('places every showcased project under exactly one offer', () => {
    for (const slug of Object.keys(showcase)) {
      const owners = offers.filter((o) => o.examples.includes(slug));
      expect(owners, slug).toHaveLength(1);
      expect(offerForProject(slug)).toBe(owners[0]);
    }
  });

  it('has nothing to say about an unknown project', () => {
    expect(getShowcase('no-such-project')).toBeUndefined();
    expect(getShowcase('constructor')).toBeUndefined();
  });
});

describe('translations', () => {
  /**
   * The dictionaries' types already guarantee every key exists in every
   * locale. What they cannot catch is English pasted in as a placeholder —
   * fallback-language leakage — so the new commercial copy is compared
   * against English and must differ, bar words that are genuinely the same.
   */
  const sameInEnglish: Partial<Record<string, TranslationKey[]>> = {
    fr: ['showcase.language'], // "Interface"
  };

  const commercialKeys = (Object.keys(dictionaries.en) as TranslationKey[]).filter(
    (k) =>
      /^(offers|showcase|languages)\./.test(k) ||
      ['nav.offers', 'hero.headlineLead', 'hero.headlineTail', 'hero.description',
        'hero.seeOffers', 'hero.factDemos', 'hero.factLanguages'].includes(k),
  );

  it.each(['es', 'it', 'fr', 'de', 'ru'] as const)('%s is translated, not copied', (locale) => {
    const leaked = commercialKeys.filter(
      (k) =>
        dictionaries[locale][k] === dictionaries.en[k] &&
        !sameInEnglish[locale]?.includes(k),
    );
    expect(leaked).toEqual([]);
  });
});
