import type { Locale } from '../config';

/**
 * Country → language inference, keyed by ISO 3166-1 alpha-2 code.
 *
 * This is the single place country knowledge lives; nothing else in the app
 * hard-codes a country. Adding or re-pointing a country is a one-line edit
 * here.
 *
 * Country is only ever a *secondary* signal — a browser language always wins
 * (see `detectLanguage`), because where a visitor's IP happens to land says
 * far less about the language they read than the languages they configured.
 */
export const countryLanguages: Readonly<Record<string, Locale>> = {
  // English
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',

  // Spanish
  ES: 'es',
  MX: 'es',
  CU: 'es',
  AR: 'es',
  CL: 'es',
  CO: 'es',
  PE: 'es',
  VE: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  EC: 'es',
  DO: 'es',
  CR: 'es',
  PA: 'es',
  GT: 'es',
  HN: 'es',
  SV: 'es',
  NI: 'es',

  // Italian
  IT: 'it',

  // French
  FR: 'fr',
  BE: 'fr',
  LU: 'fr',
  MC: 'fr',

  // German
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',

  // Russian
  RU: 'ru',
  BY: 'ru',
  KZ: 'ru',
  KG: 'ru',
};

/** `ru` for `RU`/`ru`, `null` for an unmapped or malformed code. */
export function countryToLanguage(
  country: string | undefined | null,
): Locale | null {
  if (!country) return null;
  return countryLanguages[country.trim().toUpperCase()] ?? null;
}
