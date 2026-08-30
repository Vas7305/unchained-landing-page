import type { Locale } from '../config';
import { en, enLists } from './en';
import { es, esLists } from './es';
import { it, itLists } from './it';
import { fr, frLists } from './fr';
import { de, deLists } from './de';
import { ru, ruLists } from './ru';

export type {
  TranslationKey,
  ListKey,
  Dictionary,
  ListDictionary,
} from './en';

/**
 * Every locale is typed against the English key set, so adding a string to
 * `en.ts` without translating it elsewhere fails the build rather than
 * silently falling back at runtime.
 */
export const dictionaries = { en, es, it, fr, de, ru } satisfies Record<
  Locale,
  unknown
>;

export const listDictionaries = {
  en: enLists,
  es: esLists,
  it: itLists,
  fr: frLists,
  de: deLists,
  ru: ruLists,
} satisfies Record<Locale, unknown>;
