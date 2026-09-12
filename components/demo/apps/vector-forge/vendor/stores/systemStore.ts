import { create } from 'zustand';
import type { EngineStats } from '../types';

interface SystemStore extends EngineStats {
  apply(stats: EngineStats): void;
}

export const useSystemStore = create<SystemStore>((set) => ({
  vramUsedGb: 0,
  vramTotalGb: 0,
  cudaCores: 0,
  engineActive: false,
  cpuPct: 0,
  gpuPct: 0,

  apply: (stats) => set(stats),
}));
