import { resolveLocale, type Locale } from '../config';

/**
 * Normalises one browser language tag onto a supported locale:
 * `en-GB` → `en`, `es-419` → `es`, `ru-UA` → `ru`, `pt-BR` → `null`.
 *
 * Deliberately the same routine the language provider has always used, so a
 * tag can never resolve one way here and another way there.
 */
export const normalizeBrowserLanguage = resolveLocale;

/** First supported locale in the visitor's ordered preference list. */
export function pickBrowserLanguage(
  tags: readonly string[] | undefined | null,
): Locale | null {
  if (!tags) return null;
  for (const tag of tags) {
    const match = normalizeBrowserLanguage(tag);
    if (match) return match;
  }
  return null;
}
