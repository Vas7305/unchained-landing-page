import { defaultLocale, isLocale, type Locale } from '../config';
import { pickBrowserLanguage } from './browserLanguage';
import { countryToLanguage } from './countryLanguage';

export type LanguageSignals = {
  /** A language the visitor picked themselves, read back from storage. */
  savedLocale?: string | null;
  /** `navigator.languages`, most-preferred first. */
  browserLanguages?: readonly string[] | null;
  /** ISO 3166-1 alpha-2 country, when the edge gave us one. */
  country?: string | null;
};

export type LanguageSource = 'saved' | 'browser' | 'country' | 'default';

export type LanguageDetection = {
  locale: Locale;
  /** Which signal decided it — lets callers tell a guess from a choice. */
  source: LanguageSource;
};

/**
 * The one decision function. Pure, synchronous and total: every combination of
 * signals maps to exactly one locale, in this order of trust —
 *
 *   1. an explicit saved preference   (never overridden, VPN or not)
 *   2. the browser's language list    (what the visitor actually configured)
 *   3. the country the edge reported  (a hint, used only when 2 said nothing)
 *   4. English
 *
 * Country deliberately sits below the browser list: a Russian IP with an
 * `en-US` browser is an English reader abroad far more often than not.
 */
export function detectLanguage(signals: LanguageSignals): LanguageDetection {
  if (isLocale(signals.savedLocale)) {
    return { locale: signals.savedLocale, source: 'saved' };
  }

  const browser = pickBrowserLanguage(signals.browserLanguages);
  if (browser) return { locale: browser, source: 'browser' };

  const inferred = countryToLanguage(signals.country);
  if (inferred) return { locale: inferred, source: 'country' };

  return { locale: defaultLocale, source: 'default' };
}

/** `detectLanguage` when only the answer matters. */
export function detectInitialLanguage(signals: LanguageSignals): Locale {
  return detectLanguage(signals).locale;
}
