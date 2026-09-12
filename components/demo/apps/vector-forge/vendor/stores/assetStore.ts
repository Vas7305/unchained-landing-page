import { create } from 'zustand';
import type { ImageRef, ImageFile, AssetMetadata, ThumbnailInfo, AssetItem } from '../types';
import { probeAsset } from '../services/probe';
import { generateThumbnail, removeThumbnailCache, clearThumbnailCache } from '../services/thumbnails';
import { copyAssetToProject } from '../services/fs';
import { useProjectStore } from './projectStore';
import { useToastStore } from './toastStore';

interface AssetStoreState {
  assets: AssetItem[];
  activeAssetId: string | null;
}

interface AssetStoreActions {
  addRefs(refs: ImageRef[], projectDir?: string): void;
  removeRef(id: string): void;
  clearAssets(): void;
  promoteToFile(id: string, file: ImageFile, metadata: AssetMetadata): void;
  setActiveAsset(id: string | null): void;
  generateThumbnail(id: string, projectDir: string): Promise<void>;
  loadAsset(id: string, projectDir: string): Promise<void>;
  getAssetById(id: string): AssetItem | undefined;
}

type AssetStore = AssetStoreState & AssetStoreActions;

export const useAssetStore = create<AssetStore>((set, get) => ({
  assets: [],
  activeAssetId: null,

  addRefs: (refs, projectDir = '') => {
    const newItems: AssetItem[] = refs.map((ref) => ({
      id: ref.id,
      ref,
      status: 'pending',
    }));

    set((s) => ({ assets: [...s.assets, ...newItems] }));

    for (const item of newItems) {
      get()
        .loadAsset(item.id, projectDir)
        .catch(() => {
          set((s) => ({
            assets: s.assets.map((a) =>
              a.id === item.id ? { ...a, status: 'error' as const, error: 'Failed to load asset' } : a
            ),
          }));
        });
    }
  },

  removeRef: (id) => {
    removeThumbnailCache(id);
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id),
      activeAssetId: s.activeAssetId === id ? null : s.activeAssetId,
    }));
  },

  clearAssets: () => {
    clearThumbnailCache();
    set({ assets: [], activeAssetId: null });
  },

  promoteToFile: (id, file, metadata) => {
    set((s) => ({
      assets: s.assets.map((a) =>
        a.id === id ? { ...a, file, metadata, status: 'ready' as const } : a
      ),
    }));
  },

  setActiveAsset: (id) => set({ activeAssetId: id }),

  generateThumbnail: async (id, projectDir) => {
    const asset = get().getAssetById(id);
    if (!asset?.file) return;
    try {
      const thumb: ThumbnailInfo = await generateThumbnail(asset.file, projectDir);
      set((s) => ({
        assets: s.assets.map((a) => (a.id === id ? { ...a, thumbnail: thumb } : a)),
      }));
    } catch {
      // thumbnails are non-critical
    }
  },

  loadAsset: async (id, projectDir) => {
    const asset = get().getAssetById(id);
    if (!asset || asset.status !== 'pending') return;

    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, status: 'probing' as const } : a)),
    }));

    try {
      let ref = asset.ref;

      if (projectDir) {
        const destPath = await copyAssetToProject(ref, projectDir);
        ref = { ...ref, path: destPath };
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, ref } : a)),
        }));
      }

      const { file, metadata } = await probeAsset(ref);
      get().promoteToFile(id, file, metadata);

      if (!get().activeAssetId) {
        get().setActiveAsset(id);
      }

      // DEMO DIVERGENCE — the product also writes the asset into the project's
      // `project.json` so it survives a restart, then mirrors the active id
      // back into Zustand. Nothing is written here, so only the mirror is
      // kept: the other screens still see which asset is active.
      if (projectDir) {
        if (!get().activeAssetId || get().activeAssetId === id) {
          useProjectStore.getState().updateActiveRefs({ activeAssetId: ref.id });
        }
        void get().generateThumbnail(id, projectDir);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      set((s) => ({
        assets: s.assets.map((a) =>
          a.id === id ? { ...a, status: 'error' as const, error: msg } : a
        ),
      }));
      useToastStore.getState().show('danger', `Failed to import: ${asset.ref.name}`);
    }
  },

  getAssetById: (id) => get().assets.find((a) => a.id === id),
}));

/** @internal Called by the demo's Reset. See vendor/demo-reset.ts. */
export function resetAssetStore(): void {
  useAssetStore.getState().clearAssets();
}
