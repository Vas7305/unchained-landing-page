/**
 * The enhance store, reduced to the part Convert reads.
 *
 * VectorForge's Enhance screen upscales and denoises a raster before it is
 * traced, and records the result per asset. Convert then prefers that enhanced
 * version over the original — the "Enhanced ↓ Original priority" effect in
 * ConvertScreen.
 *
 * The Enhance screen is not part of this demo, so no asset ever gets an
 * enhanced version and the map stays empty. It exists rather than being
 * deleted because the effect that reads it is the product's code, and an
 * empty map is exactly what the product hands it before anybody visits
 * Enhance — the branch is taken the same way here as there.
 */

import { create } from 'zustand';

interface EnhancedVersion {
  id: string;
  path: string;
  width: number;
  height: number;
}

interface EnhanceStore {
  enhancedByAssetId: Record<string, EnhancedVersion>;
}

export const useEnhanceStore = create<EnhanceStore>(() => ({
  enhancedByAssetId: {},
}));
