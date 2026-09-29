import type { Locale } from './config';

/**
 * A language's name, written in the visitor's language: `ru` is "Russian" to
 * an English reader and "Ruso" to a Spanish one.
 *
 * Intl rather than dictionary keys, because the set of languages the products
 * we build are written in is open-ended and the platform already carries every
 * name in every locale. Capitalised, since it is shown as a standalone label —
 * several locales write language names in lower case mid-sentence.
 *
 * Falls back to the upper-cased code rather than throwing: a label reading
 * "PT" is a worse label, not a broken page.
 */
export function languageName(code: string, locale: Locale): string {
  const base = code.split('-')[0].toLowerCase();
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(base);
    if (!name || name === base) return base.toUpperCase();
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return base.toUpperCase();
  }
}
