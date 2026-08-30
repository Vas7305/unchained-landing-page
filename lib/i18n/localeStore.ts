import {
  LOCALE_STORAGE_KEY,
  defaultLocale,
  isLocale,
  resolveLocale,
  type Locale,
} from './config';

/**
 * The locale lives in an external store rather than component state so that
 * `useSyncExternalStore` can hand React a server snapshot (always
 * `defaultLocale`, matching the prerendered HTML) and a client snapshot (the
 * visitor's stored or browser-preferred language) without a hydration
 * mismatch — and without a setState-in-effect cascade.
 */

let current: Locale | null = null;
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

function readPreferred(): Locale {
  const stored = readStored();
  if (stored) return stored;

  for (const tag of navigator.languages ?? [navigator.language]) {
    const match = resolveLocale(tag);
    if (match) return match;
  }

  return defaultLocale;
}

function emit() {
  for (const listener of listeners) listener();
}

export function getSnapshot(): Locale {
  // Cached so repeat calls return an identical value, as the hook requires.
  if (current === null) current = readPreferred();
  return current;
}

export function getServerSnapshot(): Locale {
  return defaultLocale;
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);

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
  const next = isLocale(event.newValue) ? event.newValue : defaultLocale;
  if (next === current) return;
  current = next;
  emit();
}

export function setLocale(next: Locale): void {
  if (next === getSnapshot()) return;

  current = next;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    // Preference just won't persist across visits.
  }
  emit();
}
