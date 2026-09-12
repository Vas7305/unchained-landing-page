import { create } from 'zustand';

export interface ToastItem {
  id: string;
  tone: 'accent' | 'danger' | 'success';
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  show(tone: ToastItem['tone'], message: string): void;
  dismiss(id: string): void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  show: (tone, message) => {
    const id = String(++counter);
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
