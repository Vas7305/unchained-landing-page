'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { defaultLocale, type Locale } from './config';
import {
  dictionaries,
  listDictionaries,
  type ListKey,
  type TranslationKey,
} from './dictionaries';
import {
  getServerSnapshot,
  getSnapshot,
  setLocale as persistLocale,
  subscribe,
} from './localeStore';

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  /** List-valued strings — bullet lists, feature lists, signal lists. */
  tList: (key: ListKey) => readonly string[];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * There is no server-side locale negotiation: every page ships prerendered in
 * `defaultLocale` and switches on the client. `proxy.ts` supplies the
 * visitor's country, never their language — see docs/hosting.md.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setLocale = useCallback((next: Locale) => persistLocale(next), []);

  // Keep the document language in sync so screen readers and browser
  // translation prompts follow the visible content.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = dictionaries[locale];
    const lists = listDictionaries[locale];
    return {
      locale,
      setLocale,
      t: (key) => dictionary[key] ?? dictionaries[defaultLocale][key] ?? key,
      tList: (key) => lists[key] ?? listDictionaries[defaultLocale][key],
    };
  }, [locale, setLocale]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside a <LanguageProvider>');
  }
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useTranslation() {
  return useLanguage().t;
}
