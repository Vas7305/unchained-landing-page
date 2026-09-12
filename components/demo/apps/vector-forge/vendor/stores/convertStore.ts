import { create } from 'zustand';
import type {
  ConvertState,
  SetFn,
  ImageFile,
  VectorizationResult,
  PreviewMode,
  VectorizationOptions,
} from '../types';
import { usePreferencesStore } from './preferencesStore';

interface ConvertStoreExtended extends ConvertState {
  set: SetFn<ConvertState>;
  reset(): void;

  // Module 06 — extended state
  activeFile: ImageFile | null;
  result: VectorizationResult | null;
  previewMode: PreviewMode;
  isVectorizing: boolean;
  vectorizeProgress: number;
  vectorizeStage: string;
  vectorizeError: string | null;
  _abortController: AbortController | null;

  // Module 06 — methods
  setActiveAsset(file: ImageFile | null): void;
  setVectorizationOptions(opts: Partial<VectorizationOptions>): void;
  startVectorization(projectDir: string): Promise<void>;
  cancelVectorization(): void;
  loadResult(result: VectorizationResult): void;
  clearResult(): void;
  setPreviewMode(mode: PreviewMode): void;
  toggleNodeOverlay(): void;
}

const DEFAULTS: ConvertState = {
  convertMode: 'logo',
  nodeViz: false,
  zoom: 100,
  dragOver: false,
  detail: 62,
  colors: 16,
  smoothing: 48,
  simplify: true,
};

/**
 * Starting Detail/Colors/Smoothing per Settings > Quality Preset. Applied
 * when a fresh asset becomes active (no asset was active before) and on
 * explicit Reset — per-asset slider tweaks made afterward are left alone
 * until the next fresh asset.
 */
const QUALITY_PRESET_ENGINE_DEFAULTS: Record<
  'fast' | 'balanced' | 'max',
  Pick<ConvertState, 'detail' | 'colors' | 'smoothing'>
> = {
  fast:     { detail: 35, colors: 8,  smoothing: 70 },
  balanced: { detail: 62, colors: 16, smoothing: 48 },
  max:      { detail: 90, colors: 32, smoothing: 20 },
};

function qualityPresetEngineDefaults(): Pick<ConvertState, 'detail' | 'colors' | 'smoothing'> {
  return QUALITY_PRESET_ENGINE_DEFAULTS[usePreferencesStore.getState().qualityPreset];
}

export const useConvertStore = create<ConvertStoreExtended>((set, get) => ({
  ...DEFAULTS,

  // Blueprint SetFn<ConvertState>
  set: (key, value) => set((s) => ({ ...s, [key]: value })),

  reset: () => set({ ...DEFAULTS, ...qualityPresetEngineDefaults() }),

  // Module 06 state
  activeFile: null,
  result: null,
  previewMode: 'source',
  isVectorizing: false,
  vectorizeProgress: 0,
  vectorizeStage: '',
  vectorizeError: null,
  _abortController: null,

  setActiveAsset: (file) => {
    const isFreshAsset = !!file && !get().activeFile;
    set({
      activeFile: file,
      result: null,
      previewMode: file ? 'source' : 'source',
      vectorizeError: null,
      vectorizeProgress: 0,
      ...(isFreshAsset ? qualityPresetEngineDefaults() : {}),
    });
  },

  setVectorizationOptions: (opts) => {
    const updates: Partial<ConvertState> = {};
    if (opts.mode !== undefined) updates.convertMode = opts.mode;
    if (opts.detail !== undefined) updates.detail = opts.detail;
    if (opts.colors !== undefined) updates.colors = opts.colors;
    if (opts.smoothing !== undefined) updates.smoothing = opts.smoothing;
    set((s) => ({ ...s, ...updates }));
  },

  startVectorization: async (projectDir) => {
    const { activeFile, convertMode, detail, colors, isVectorizing } = get();
    if (!activeFile || isVectorizing) return;

    const controller = new AbortController();
    set({ isVectorizing: true, vectorizeProgress: 0, vectorizeStage: '', vectorizeError: null, _abortController: controller });

    try {
      const { vectorize } = await import('../services/vectorize');
      const result = await vectorize(
        activeFile,
        { mode: convertMode, detail, colors, smoothing: get().smoothing },
        projectDir,
        (pct, stage) => {
          if (!controller.signal.aborted) {
            set({ vectorizeProgress: pct, vectorizeStage: stage });
          }
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        set({
          result,
          isVectorizing: false,
          vectorizeProgress: 100,
          vectorizeStage: '',
          previewMode: 'split',
          _abortController: null,
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        set({
          isVectorizing: false,
          vectorizeProgress: 0,
          vectorizeStage: '',
          vectorizeError: err instanceof Error ? err.message : 'Vectorization failed',
          _abortController: null,
        });
      }
    }
  },

  cancelVectorization: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set({ isVectorizing: false, vectorizeProgress: 0, vectorizeStage: '', _abortController: null });
  },

  loadResult: (result) => {
    set({ result, previewMode: 'split' });
  },

  clearResult: () => {
    set({ result: null, previewMode: 'source', vectorizeError: null, vectorizeProgress: 0 });
  },

  setPreviewMode: (mode) => {
    set({ previewMode: mode });
  },

  toggleNodeOverlay: () => {
    set((s) => ({ nodeViz: !s.nodeViz }));
  },

  // DEMO DIVERGENCE — `loadResultFromProject` is gone. It reopened the SVG a
  // previous session had written into the project directory, through Tauri's
  // file reader. This demo writes nothing and reopens nothing, so the method,
  // its declaration above and ConvertScreen's rehydrate effect were all
  // removed together rather than left as a branch that can never be taken.
}));

/** @internal Called by the demo's Reset. See vendor/demo-reset.ts. */
export function resetConvertStore(): void {
  useConvertStore.getState().cancelVectorization();
  useConvertStore.setState({
    ...DEFAULTS,
    activeFile: null,
    result: null,
    previewMode: 'source',
    isVectorizing: false,
    vectorizeProgress: 0,
    vectorizeStage: '',
    vectorizeError: null,
    _abortController: null,
  });
}
