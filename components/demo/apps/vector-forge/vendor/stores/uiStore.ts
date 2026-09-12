import { create } from 'zustand';
import type { Screen, Theme, PerfMode } from '../types';

interface UiState {
  screen: Screen;
  theme: Theme;
  /** Always 'cpu' in v1.0 — there is no GPU vectorization/compute engine, so no UI offers to change this. */
  perfMode: PerfMode;
  panelWidths: { sidebar: number; right: number };
}

interface UiStore extends UiState {
  setScreen(s: Screen): void;
  setPanelWidth(panel: 'sidebar' | 'right', width: number): void;
}

const PANEL_LIMITS: Record<'sidebar' | 'right', [min: number, max: number]> = {
  sidebar: [240, 420],
  right: [300, 560],
};

export const useUiStore = create<UiStore>((set) => ({
  screen: 'dashboard',
  theme: 'dark',
  perfMode: 'cpu',
  panelWidths: { sidebar: 280, right: 340 },

  setScreen: (screen) => {
    set({ screen });
    // DEMO DIVERGENCE — the product also records the screen in appSettingsStore
    // so a restart reopens it. Nothing here outlives the tab, and session
    // restoration would fight the demo's Reset, so the write is dropped.
  },
  setPanelWidth: (panel, width) =>
    set((s) => {
      const [min, max] = PANEL_LIMITS[panel];
      const clamped = Math.min(max, Math.max(min, width));
      return { panelWidths: { ...s.panelWidths, [panel]: clamped } };
    }),
}));

// Screens that show the right panel
export const SCREENS_WITH_PANEL = new Set<Screen>([
  'convert',
  'enhance',
  'optimize',
  'web',
  'export',
]);
