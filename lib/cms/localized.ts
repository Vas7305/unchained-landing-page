/**
 * Localized CMS content, and how the site chooses which words to render.
 *
 * ─── The architecture this fits into ──────────────────────────────────────
 * The website has ONE URL per page. lib/i18n/LanguageProvider.tsx: "There is
 * no server-side locale negotiation: every page ships prerendered in
 * defaultLocale and switches on the client."
 *
 * That is the whole reason translations arrive as a MAP attached to the
 * content rather than as a different response per language. The server
 * prerenders the default locale — which is what a crawler indexes and what a
 * visitor sees before hydration — and the same payload already contains the
 * other five, so switching language is a re-render and not a request. It is
 * exactly how the UI dictionaries in lib/i18n/dictionaries already work; this
 * extends the same mechanism from the interface chrome to the content.
 *
 * ─── Fallback is per FIELD, not per record ────────────────────────────────
 * A translation row may hold the title and the description but not the case
 * study. Merging field by field means a partially translated project reads in
 * the visitor's language as far as the translator got, and in the default
 * locale after that — rather than snapping back to English wholesale because
 * one field was missing.
 *
 * The database cooperates: list_public_projects() builds each locale's object
 * with jsonb_strip_nulls, so an untranslated field is an ABSENT KEY rather
 * than an explicit null, and `??` does the right thing with no extra checks.
 */

import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';
import { record } from './sanitize';

/**
 * Translations of `T`, keyed by locale, each holding only the fields that were
 * actually translated.
 */
export type Localized<T> = Partial<Record<Locale, Partial<T>>>;

/**
 * Read a `translations` object out of an untrusted payload.
 *
 * `readOne` is the per-content-type reader: it receives one locale's raw
 * object and returns the sanitised fields, dropping anything it does not
 * recognise. So this function owns the SHAPE (an object keyed by known
 * locales) and the caller owns the FIELDS.
 *
 * A locale the site was not built with is dropped rather than kept. The
 * database will not serve one — list_public_projects() filters on
 * unchained_locales.active — but the site has no dictionary for it either, so
 * a visitor could never select it and the entry would be dead weight in every
 * page's payload.
 *
 * Returns undefined rather than {} when there is nothing, so a caller can
 * leave the property off the object entirely.
 */
export function readTranslations<T>(
  value: unknown,
  readOne: (row: Record<string, unknown>) => Partial<T>,
): Localized<T> | undefined {
  const raw = record(value);
  if (!raw) return undefined;

  const out: Localized<T> = {};
  let found = false;

  for (const [code, entry] of Object.entries(raw)) {
    if (!isLocale(code)) continue;
    const row = record(entry);
    if (!row) continue;

    const fields = readOne(row);
    // A locale whose every field failed sanitisation is not a translation.
    // Keeping it would make `hasTranslation` true for a row that renders
    // identically to the default.
    if (Object.keys(fields).length === 0) continue;

    out[code] = fields;
    found = true;
  }

  return found ? out : undefined;
}

/**
 * The content as one locale renders it.
 *
 * Every key the translation actually carries wins; everything else falls back
 * to the base record, which is written in the default locale.
 *
 * Asking for the default locale returns the base unchanged, without consulting
 * the map. A translation row for the default locale should not exist — the
 * parent IS that locale — and if one were somehow created, letting it override
 * the parent would give the site two competing answers for the same language.
 */
export function localize<T extends object>(
  base: T,
  translations: Localized<T> | undefined,
  locale: Locale,
): T {
  if (locale === defaultLocale || !translations) return base;

  const overlay = translations[locale];
  if (!overlay) return base;

  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    // `undefined` means "not translated". An explicit value — including an
    // empty array, which a translator can legitimately mean — is applied.
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * The locales this content has been translated into, in the site's own order.
 *
 * Used by the panel's coverage view and by nothing on the public site: the
 * site renders one language at a time and does not advertise the others,
 * because there is no second URL to advertise (see the module header, and
 * §hreflang in docs/cms.md).
 */
export function translatedLocales<T>(
  translations: Localized<T> | undefined,
): Locale[] {
  if (!translations) return [];
  return (Object.keys(translations) as Locale[]).filter(isLocale);
}
