import { usePreferencesStore } from '../stores/preferencesStore';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import it from '../i18n/it.json';
import type { Lang } from '../types';

type TranslationKey = keyof typeof en;

const catalogues: Record<Lang, Record<string, string>> = { en, es, it };

export function useT(): (key: TranslationKey) => string {
  const language = usePreferencesStore((s) => s.language);
  const catalogue = catalogues[language] ?? catalogues.en;
  return (key: TranslationKey) => catalogue[key] ?? en[key] ?? key;
}
