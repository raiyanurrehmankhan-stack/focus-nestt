// Sign in / sign up / sign out, and loading the current user on start-up.
import { levelInfo } from '@shared/rules.js';
import { HAS_BACKEND } from '../config.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { toast } from '../store/useToastStore.js';
import { todayKey } from '../utils/time.js';
import { invalidate } from './events.js';
import * as local from './localApi.js';
import { refreshPushRegistration } from './push.js';
import * as remote from './remoteApi.js';
import { connectSocket, disconnectSocket } from './socket.js';

function applyState({ user, active, capabilities }, mode) {
  const app = useAppStore.getState();
  app.setUser(user, mode);
  if (capabilities) app.setCapabilities(capabilities);
  useTimerStore.getState().setActive(active || null);
  if (user) useProgressStore.getState().apply({ points: user.points, level: levelInfo(user.points || 0), streakDays: user.streakDays });
}

export async function loadSession() {
  const app = useAppStore.getState();
  if (HAS_BACKEND && remote.getToken()) {
    try {
      const state = await remote.getState(todayKey());
      applyState(state, 'account');
      app.setOfflineData(Boolean(state._offline));
      app.setBootError(null);
      connectSocket();
      refreshPushRegistration();
      return;
    } catch (err) {
      if (err.status === 401) await signOut({ silent: true });
      else {
        // Server unreachable and nothing cached yet: let the user retry.
        app.setBootError(err.message || 'Could not reach the FocusNest server.');
        return;
      }
    }
  }
  app.setBootError(null);
  if (local.hasLocalProfile()) applyState(await local.getState(), 'guest');
  else app.setUser(null, 'guest');
}

export async function signIn(credentials) {
  const res = await remote.login(credentials);
  remote.setToken(res.token);
  await loadSession();
  invalidate('*');
  return res.user;
}

/** Creates an account; optionally moves this device's guest data into it. */
export async function signUp(data, { importGuest = false } = {}) {
  const res = await remote.register(data);
  remote.setToken(res.token);
  if (importGuest && local.hasGuestData()) {
    try {
      await remote.importGuest(local.buildImportBundle(todayKey()));
      toast.success('Your progress from this device was added to your account.');
    } catch (err) {
      toast.info(`Your account is ready, but we could not import local data: ${err.message}`);
    }
  }
  await loadSession();
  invalidate('*');
  return res.user;
}

export async function signOut({ silent = false, everywhere = false } = {}) {
  if (everywhere) await remote.logoutAll().catch(() => {});
  remote.setToken(null);
  remote.clearCache();
  disconnectSocket();
  useTimerStore.getState().setActive(null);
  useAppStore.getState().setBootError(null);
  if (!silent) toast.info('You are signed out. Guest mode keeps working on this device.');
  if (local.hasLocalProfile()) applyState(await local.getState(), 'guest');
  else useAppStore.getState().setUser(null, 'guest');
  invalidate('*');
}

remote.setUnauthorizedHandler(() => {
  signOut({ silent: true }).then(() => toast.error('Your session has expired. Please sign in again.'));
});
