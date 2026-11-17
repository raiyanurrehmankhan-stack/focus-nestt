import { create } from 'zustand';

let nextId = 1;
export const useToastStore = create((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    const toast = { id, type: 'info', duration: 4000, ...t };
    set({ toasts: [...get().toasts.slice(-3), toast] });
    if (toast.duration) setTimeout(() => get().dismiss(id), toast.duration);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (message, opts) => useToastStore.getState().push({ type: 'success', message, ...opts }),
  error: (message, opts) => useToastStore.getState().push({ type: 'error', message, duration: 6000, ...opts }),
  info: (message, opts) => useToastStore.getState().push({ type: 'info', message, ...opts }),
  points: (message, opts) => useToastStore.getState().push({ type: 'points', message, ...opts }),
};
