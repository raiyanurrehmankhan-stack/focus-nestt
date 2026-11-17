// Tiny pub/sub used to refresh screens when data changes
// (after a mutation, a realtime event or a push message).
const listeners = new Map();

export function onInvalidate(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}

/** invalidate('checkins', 'dashboard') or invalidate('*') for everything. */
export function invalidate(...keys) {
  const all = keys.includes('*');
  for (const [k, set] of listeners) if (all || keys.includes(k)) set.forEach((fn) => fn());
}
