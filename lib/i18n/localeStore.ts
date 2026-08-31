import {
  LOCALE_STORAGE_KEY,
  defaultLocale,
  isLocale,
  type Locale,
} from './config';
import {
  countryToLanguage,
  detectLanguage,
  readCountry,
  requestCountry,
  type LanguageSource,
} from './languageDetection';

/**
 * The locale lives in an external store rather than component state so that
 * `useSyncExternalStore` can hand React a server snapshot (always
 * `defaultLocale`, matching the prerendered HTML) and a client snapshot (the
 * visitor's stored, browser-preferred or country-inferred language) without a
 * hydration mismatch — and without a setState-in-effect cascade.
 *
 * Storage holds a language code and nothing else, and only ever gets written
 * by `setLocale`, i.e. by the language switcher. So "there is a value in
 * storage" *is* the mark of an explicit choice, and automatic detection can
 * never overwrite one.
 */

let current: Locale | null = null;
let source: LanguageSource = 'default';
const listeners = new Set<() => void>();

function readStored(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Private mode or blocked storage.
    return null;
  }
}

function detect(): Locale {
  const detection = detectLanguage({
    savedLocale: readStored(),
    browserLanguages: navigator.languages ?? [navigator.language],
    // Synchronous and free: whatever the hosting edge put on the document.
    country: readCountry(),
  });
  source = detection.source;
  return detection.locale;
}

function emit() {
  for (const listener of listeners) listener();
}

export function getSnapshot(): Locale {
  // Cached so repeat calls return an identical value, as the hook requires.
  if (current === null) current = detect();
  return current;
}

export function getServerSnapshot(): Locale {
  return defaultLocale;
}

let countryLookupStarted = false;

/**
 * Only when every other signal came up empty — no stored choice, no supported
 * browser language, no country on the document — is it worth asking the edge
 * directly. Everyone else has already been answered synchronously, before
 * first paint, so the common visit makes no request and never re-renders.
 */
function maybeInferFromCountry() {
  if (countryLookupStarted) return;
  countryLookupStarted = true;

  // Resolve the synchronous signals first: `subscribe` can run before React
  // has asked for a snapshot.
  getSnapshot();
  if (source !== 'default' || readCountry()) return;

  void requestCountry().then((country) => {
    // A manual pick while the lookup was in flight always wins.
    if (source !== 'default') return;
    const next = countryToLanguage(country);
    if (!next || next === current) return;
    current = next;
    source = 'country';
    emit();
  });
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  maybeInferFromCountry();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** Keeps other open tabs in step when the language changes in one of them. */
function onStorage(event: StorageEvent) {
  if (event.key !== LOCALE_STORAGE_KEY) return;
  const explicit = isLocale(event.newValue);
  const next = explicit ? event.newValue : defaultLocale;
  source = explicit ? 'saved' : 'default';
  if (next === current) return;
  current = next;
  emit();
}

export function setLocale(next: Locale): void {
  const changed = next !== getSnapshot();
  // Even a "no change" pick is a choice: record it so detection stops guessing.
  source = 'saved';
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Preference just won't persist across visits.
  }
  if (!changed) return;

  current = next;
  emit();
}
