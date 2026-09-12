import { create } from 'zustand';
import type { Command } from '../types';

const LIMIT = 50;

interface HistoryStore {
  past: Command[];
  future: Command[];
  readonly limit: typeof LIMIT;
  canUndo: boolean;
  canRedo: boolean;
  push(c: Command): void;
  undo(onWarning?: (msg: string) => void): void;
  redo(): void;
  clear(): void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  limit: LIMIT,
  canUndo: false,
  canRedo: false,

  push: (c) => {
    const { past } = get();
    const next = [...past, c].slice(-LIMIT);
    set({ past: next, future: [], canUndo: next.length > 0, canRedo: false });
  },

  undo: (onWarning) => {
    const { past, future } = get();
    if (past.length === 0) return;
    const c = past[past.length - 1];
    const success = c.invert();
    if (success) {
      const nextPast = past.slice(0, -1);
      set({
        past: nextPast,
        future: [c, ...future],
        canUndo: nextPast.length > 0,
        canRedo: true,
      });
    } else {
      // P6: invert failed — discard command, clear future
      const nextPast = past.slice(0, -1);
      set({ past: nextPast, future: [], canUndo: nextPast.length > 0, canRedo: false });
      onWarning?.(`Cannot undo "${c.label}"`);
    }
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const c = future[0];
    const success = c.apply();
    const nextFuture = future.slice(1);
    if (success) {
      set({
        past: [...past, c],
        future: nextFuture,
        canUndo: true,
        canRedo: nextFuture.length > 0,
      });
    } else {
      set({ future: nextFuture, canRedo: nextFuture.length > 0 });
    }
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}));
