// Client for the FocusNest Node.js API (server/). Same function names and
// return shapes as localApi.js.
import { API_URL } from '../config.js';
import { getDeviceId } from './device.js';
import { ApiError } from './localApi.js';
import { readJSON, removeKey, writeJSON } from './storage.js';

const TOKEN_KEY = 'fn:token';
const CACHE_PREFIX = 'fn:cache:';
let token = readJSON(TOKEN_KEY);
let onUnauthorized = () => {};

export const getToken = () => token;
export const setToken = (t) => { token = t; if (t) writeJSON(TOKEN_KEY, t); else removeKey(TOKEN_KEY); };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/**
 * fetch wrapper: JSON in/out, auth header, timeouts, plain-language errors.
 * GET responses are cached in localStorage so the last known data can be
 * shown read-only while offline (personal data never goes into the SW cache).
 */
async function request(method, path, body, { cache = method === 'GET', timeout = 15000 } = {}) {
  const url = `${API_URL}/api${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Device-Id': getDeviceId(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    if (method === 'GET' && cache) {
      const hit = readJSON(CACHE_PREFIX + path);
      if (hit) return { ...hit, _offline: true };
    }
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(offline ? "You're offline. Changes can be saved once you're back online." : err.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Could not reach the FocusNest server. Please try again.', 0);
  }
  clearTimeout(timer);
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized(data?.error);
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.fields || null);
  }
  if (method === 'GET' && cache) writeJSON(CACHE_PREFIX + path, data);
  return data;
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null && v !== '')).toString();
  return s ? `?${s}` : '';
};

// auth
export const register = (data) => request('POST', '/auth/register', data, { cache: false });
export const login = (data) => request('POST', '/auth/login', data, { cache: false });
export const me = () => request('GET', '/auth/me');
export const updateProfile = (patch) => request('PATCH', '/auth/me', patch);
export const logoutAll = () => request('POST', '/auth/logout-all', {});
export const deleteAccount = (password) => request('DELETE', '/auth/me', { password });
export const exportData = () => request('GET', '/auth/export', undefined, { cache: false });
export const importGuest = (bundle) => request('POST', '/auth/import', bundle, { timeout: 30000 });

// state
export const getState = (date) => request('GET', `/state${q({ date })}`);
export const getDashboard = (date) => request('GET', `/dashboard${q({ date })}`);

// check-ins
export const saveCheckIn = (d) => request('POST', '/checkins', d);
export const listCheckIns = (range) => request('GET', `/checkins${q(range)}`);

// focus & breaks
export const getTimer = () => request('GET', '/timer', undefined, { cache: false });
export const todaySessions = (date) => request('GET', `/focus/today${q({ date })}`);
export const startFocus = (d) => request('POST', '/focus', d);
export const updateFocus = (id, action) => request('PATCH', `/focus/${id}`, { action });
export const startBreak = (d) => request('POST', '/breaks', d);
export const extendBreak = (id, d) => request('POST', `/breaks/${id}/extend`, d);
export const closeBreak = (id, d) => request('POST', `/breaks/${id}/close`, d);

// sleep
export const getSleepWeek = (date) => request('GET', `/sleep/week${q({ date })}`);
export const saveSleep = (d) => request('POST', '/sleep', d);

// wins & goals
export const listWins = () => request('GET', '/wins');
export const addWins = (d) => request('POST', '/wins', d);
export const deleteWin = (id) => request('DELETE', `/wins/${id}`);
export const listGoals = () => request('GET', '/goals');
export const createGoal = (d) => request('POST', '/goals', d);
export const updateGoal = (id, d) => request('PATCH', `/goals/${id}`, d);
export const deleteGoal = (id) => request('DELETE', `/goals/${id}`);

// quests & activities
export const getQuests = (date) => request('GET', `/quests${q({ date })}`);
export const listActivities = () => request('GET', '/activities');
export const randomActivity = (p) => request('GET', `/activities/random${q(p)}`, undefined, { cache: false });
export const completeActivity = (d) => request('POST', '/activities/complete', d);
export const activityHistory = () => request('GET', '/activities/history');

// community & night lock
export const getCampus = () => request('GET', '/campus/events');
export const joinEvent = (id, joined) => request('POST', `/campus/events/${encodeURIComponent(id)}/join`, { joined });
export const getNightLock = () => request('GET', '/nightlock');
export const saveNightLock = (d) => request('PUT', '/nightlock', d);

// devices & push
export const listDevices = () => request('GET', '/devices', undefined, { cache: false });
export const registerDevice = (d) => request('POST', '/devices', d);
export const removeDevice = (id) => request('DELETE', `/devices/${encodeURIComponent(id)}`);
export const pushPublicKey = () => request('GET', '/push/public-key', undefined, { cache: false });
export const testPush = () => request('POST', '/push/test', {});
export const health = () => fetch(`${API_URL}/api/health`).then((r) => r.json()).catch(() => ({ ok: false }));
