// Single entry point for all data access (doc section 6.3).
// • Guest mode  → localApi (this device only, works fully offline)
// • Account mode → remoteApi (Node.js API + MongoDB, synced across devices)
// Screens import `api` and never care which one is active.
import { HAS_BACKEND } from '../config.js';
import * as local from './localApi.js';
import * as remote from './remoteApi.js';

export const isAccountMode = () => HAS_BACKEND && Boolean(remote.getToken());
const impl = () => (isAccountMode() ? remote : local);

const pick = (name) => (...args) => {
  const fn = impl()[name];
  if (typeof fn !== 'function') throw new Error(`api.${name} is not available in this mode`);
  return fn(...args);
};

export const api = new Proxy({}, { get: (_t, name) => pick(name) });
export { local as localApi, remote as remoteApi };
export { ApiError } from './localApi.js';
