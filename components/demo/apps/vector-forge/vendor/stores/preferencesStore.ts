import { create } from 'zustand';
import type { UserPreferences, Lang } from '../types';
import { loadPreferences, savePreferences } from '../services/preferences';

interface PreferencesStore extends UserPreferences {
  hydrated: boolean;
  hydrate(): Promise<void>;
  setExportDir(p: string): void;
  setQualityPreset(q: UserPreferences['qualityPreset']): void;
  setLanguage(l: Lang): void;
}

const DEFAULTS: UserPreferences = {
  theme: 'dark',
  perfMode: 'gpu',
  exportDir: '',
  qualityPreset: 'balanced',
  language: 'en',
};

let saveDebounce: ReturnType<typeof setTimeout> | null = null;

function persist(state: UserPreferences) {
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => savePreferences(state), 300);
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    const saved = await loadPreferences();
    set({ ...DEFAULTS, ...saved, hydrated: true });
  },

  setExportDir: (exportDir) => {
    set({ exportDir });
    persist(get());
  },

  setQualityPreset: (qualityPreset) => {
    set({ qualityPreset });
    persist(get());
  },

  setLanguage: (language) => {
    set({ language });
    persist(get());
  },
}));
