import { create } from 'zustand';
import { readJSON, writeJSON } from '../services/storage.js';

const prefs = readJSON('fn:prefs', {}) || {};

/** User, settings, theme and app-level status (doc 6.2: useAppStore). */
export const useAppStore = create((set, get) => ({
  ready: false,
  bootError: null, // account mode: server unreachable on first load
  user: null, // public profile (guest or account)
  mode: 'guest', // 'guest' | 'account'
  theme: prefs.theme || 'auto',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  offlineData: false, // showing cached data while offline
  capabilities: { push: false, vapidPublicKey: null },
  sync: { status: 'off', devices: 0 }, // realtime connection status
  install: { canPrompt: false, installed: false },
  update: { available: false, offlineReady: false },

  setReady: (ready) => set({ ready }),
  setBootError: (bootError) => set({ bootError }),
  setUser: (user, mode = get().mode) => {
    set({ user, mode });
    if (user?.theme && user.theme !== get().theme) get().setTheme(user.theme, { persistOnly: true });
  },
  patchUser: (patch) => set({ user: { ...get().user, ...patch } }),
  setTheme: (theme) => {
    writeJSON('fn:prefs', { ...(readJSON('fn:prefs', {}) || {}), theme });
    set({ theme });
  },
  setOnline: (online) => set({ online }),
  setOfflineData: (offlineData) => set({ offlineData }),
  setCapabilities: (capabilities) => set({ capabilities: { ...get().capabilities, ...capabilities } }),
  setSync: (sync) => set({ sync: { ...get().sync, ...sync } }),
  setInstall: (install) => set({ install: { ...get().install, ...install } }),
  setUpdate: (update) => set({ update: { ...get().update, ...update } }),
}));
