/**
 * What a client can buy, as data.
 *
 * ─── Why this is code and not a CMS table ─────────────────────────────────
 * Three offers, each a commercial commitment. A price on this site is a
 * promise somebody will be held to, and a change to one is a decision rather
 * than an edit — it belongs in a reviewed commit alongside the copy that
 * describes it, the same way lib/site.ts holds the three pillars.
 *
 * ─── Every unconfirmed fact is `null`, never a placeholder ────────────────
 * The offers exist as positioning — who each one is for and what problem it
 * solves — before their commercial terms are fixed. Scope, delivery time,
 * starting price and included languages are each nullable, and a null is
 * rendered as what is actually true today: that it is agreed with the client
 * on the free intro call. There is no "TBD", no "from $—", and no default
 * number waiting to be forgotten.
 *
 * ─── A price never ships without the scope it buys ────────────────────────
 * `publishedPrice()` is the only way a component reads a price, and it
 * returns nothing for an offer whose scope or delivery time is undefined.
 * lib/offers.test.ts pins the same rule over the data, so setting a price
 * without them fails the build instead of reaching the page.
 *
 * ─── Offer A's proposed price ─────────────────────────────────────────────
 * USD 1,800 has been proposed as Offer A's starting price. It is deliberately
 * NOT entered below: the offer has no defined scope or delivery time yet, and
 * the published FAQ (`faq.a7`, which also ships as FAQPage JSON-LD) says the
 * company does not publish generic pricing. Publishing it is one change, made
 * together: `includes` and `delivery` for Offer A in all six dictionaries,
 * `startingPrice: { amount: 1800, currency: 'USD' }` here, and a rewritten
 * `faq.a7`. The hero CTA and the offer card pick the price up from here.
 */

import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import type { PillarSlug } from '@/lib/site';

export type OfferId = 'a' | 'b' | 'c';

export interface Money {
  /** Whole currency units. Offers are not priced in cents. */
  amount: number;
  currency: 'USD';
}

export interface Offer {
  id: OfferId;
  name: TranslationKey;
  /** The visible label of the offer's own CTA, e.g. "Request Offer A". */
  cta: TranslationKey;
  audience: TranslationKey;
  problem: TranslationKey;
  /** Confirmed scope. null: not yet defined, agreed on the intro call. */
  includes: ListKey | null;
  /** Confirmed delivery timeframe. null: not yet defined. */
  delivery: TranslationKey | null;
  /** Starting price. Read it through `publishedPrice()`, never directly. */
  startingPrice: Money | null;
  /**
   * Languages the offer includes as standard. null: agreed per project — the
   * site does not claim that every build ships in all six of its own.
   */
  languages: readonly Locale[] | null;
  /**
   * Portfolio projects that show what this offer produces. Linked only when
   * the project is published and has a demo — the same join the demo
   * registry describes, applied at the point of use.
   */
  examples: readonly string[];
  /** The capability pillar the offer belongs to. */
  pillar: PillarSlug;
}

export const offers: readonly Offer[] = [
  {
    id: 'a',
    name: 'offers.a.name',
    cta: 'offers.a.cta',
    audience: 'offers.a.audience',
    problem: 'offers.a.problem',
    includes: null,
    delivery: null,
    // Proposed: USD 1,800 — see the header before setting this.
    startingPrice: null,
    languages: null,
    examples: ['lazara-sersa'],
    pillar: 'growth-systems',
  },
  {
    id: 'b',
    name: 'offers.b.name',
    cta: 'offers.b.cta',
    audience: 'offers.b.audience',
    problem: 'offers.b.problem',
    includes: null,
    delivery: null,
    startingPrice: null,
    languages: null,
    examples: ['merxis-pos', 'lanna-kamilina', 'mensalere', 'klassisches-ballet'],
    pillar: 'business-automation',
  },
  {
    id: 'c',
    name: 'offers.c.name',
    cta: 'offers.c.cta',
    audience: 'offers.c.audience',
    problem: 'offers.c.problem',
    includes: null,
    delivery: null,
    startingPrice: null,
    languages: null,
    examples: ['tancerca', 'kairos'],
    pillar: 'software-development',
  },
];

/** One offer by id. Throws: an unknown id is a programming error. */
export function getOffer(id: OfferId): Offer {
  const offer = offers.find((o) => o.id === id);
  if (!offer) throw new Error(`Unknown offer: ${id}`);
  return offer;
}

/**
 * The price a visitor may be shown, or null.
 *
 * Null whenever the offer's scope or delivery time is undefined, whatever
 * `startingPrice` says: a number with nothing attached to it is not an offer.
 */
export function publishedPrice(offer: Offer): Money | null {
  if (!offer.startingPrice || !offer.includes || !offer.delivery) return null;
  return offer.startingPrice;
}

/** "$1,800" in the visitor's locale. No decimals: offers are whole amounts. */
export function formatPrice(price: Money, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(price.amount);
}

/** The offer a portfolio project is an example of, if any. */
export function offerForProject(slug: string): Offer | undefined {
  return offers.find((o) => o.examples.includes(slug));
}

/**
 * The commercial framing of a demo: who a product like it is for and what it
 * solves. Kept beside the offers because it is the same claim made from the
 * other side — "this is what Offer B produces".
 *
 * Describes the kind of business and the problem, never an outcome: there is
 * no metric, user count or result here, because none has been measured.
 * Delivery time is absent for the same reason the offers' is: it is not yet
 * defined.
 */
export const showcase: Readonly<
  Record<string, { audience: TranslationKey; problem: TranslationKey }>
> = {
  tancerca: {
    audience: 'showcase.tancerca.audience',
    problem: 'showcase.tancerca.problem',
  },
  'lanna-kamilina': {
    audience: 'showcase.lanna-kamilina.audience',
    problem: 'showcase.lanna-kamilina.problem',
  },
  'lazara-sersa': {
    audience: 'showcase.lazara-sersa.audience',
    problem: 'showcase.lazara-sersa.problem',
  },
  mensalere: {
    audience: 'showcase.mensalere.audience',
    problem: 'showcase.mensalere.problem',
  },
  'klassisches-ballet': {
    audience: 'showcase.klassisches-ballet.audience',
    problem: 'showcase.klassisches-ballet.problem',
  },
  'merxis-pos': {
    audience: 'showcase.merxis-pos.audience',
    problem: 'showcase.merxis-pos.problem',
  },
  kairos: {
    audience: 'showcase.kairos.audience',
    problem: 'showcase.kairos.problem',
  },
};

/** A project's showcase framing, or undefined. */
export function getShowcase(slug: string) {
  return Object.hasOwn(showcase, slug) ? showcase[slug] : undefined;
}
