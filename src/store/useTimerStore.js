import { create } from 'zustand';

/**
 * Focus and break sessions (doc 6.2: useTimerStore).
 * `active` mirrors the server (or local) timer. The Break Over overlay is
 * derived from it: a break with status "ended" always needs a decision.
 */
export const useTimerStore = create((set, get) => ({
  active: null,
  extendOpen: false,
  busy: false,
  lastFinished: null, // { id, kind, points } — used for celebration toasts
  phoneView: 'auto', // simulated phone: 'auto' | 'home' | 'feed' | 'focus'

  setActive: (active) => {
    const prev = get().active;
    // Ignore stale updates (e.g. an older socket event arriving late). An
    // extension legitimately moves a break from "ended" back to "running",
    // so the number of extensions counts as part of the version.
    if (prev && active && prev.id === active.id && version(active) < version(prev)) return;
    set({ active: active || null, extendOpen: active?.kind === 'break' && active?.status === 'ended' ? get().extendOpen : false });
  },
  setExtendOpen: (extendOpen) => set({ extendOpen }),
  setBusy: (busy) => set({ busy }),
  setLastFinished: (lastFinished) => set({ lastFinished }),
  setPhoneView: (phoneView) => set({ phoneView }),
}));

const ORDER = { running: 1, paused: 1, ended: 2, completed: 3, closed: 3, cancelled: 3 };
const rank = (s) => ORDER[s] || 0;
const version = (t) => (t.extensions?.length || 0) * 10 + rank(t.status);

export const isBreakOver = (t) => t?.kind === 'break' && t?.status === 'ended';
