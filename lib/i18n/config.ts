/**
 * Supported locales for the site.
 *
 * `label` is the language's own name — a language menu should always read in
 * the language it offers, never in the visitor's current one.
 */
export const locales = [
  { code: 'en', label: 'English', englishName: 'English' },
  { code: 'es', label: 'Español', englishName: 'Spanish' },
  { code: 'it', label: 'Italiano', englishName: 'Italian' },
  { code: 'fr', label: 'Français', englishName: 'French' },
  { code: 'de', label: 'Deutsch', englishName: 'German' },
  { code: 'ru', label: 'Русский', englishName: 'Russian' },
] as const;

export type Locale = (typeof locales)[number]['code'];

export const defaultLocale: Locale = 'en';

/** Key used to remember the visitor's choice between visits. */
export const LOCALE_STORAGE_KEY = 'unchained.locale';

const codes = locales.map((l) => l.code) as readonly string[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && codes.includes(value);
}

/** Maps a browser language tag (`es-419`, `de-AT`) onto a supported locale. */
export function resolveLocale(tag: string | undefined | null): Locale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split('-')[0];
  return isLocale(base) ? base : null;
}
