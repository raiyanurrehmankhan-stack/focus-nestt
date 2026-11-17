import { useEffect, useState } from 'react';
import { remainingMs } from '@shared/rules.js';

/**
 * Remaining time for a timer, computed from its end timestamp every tick so
 * background-tab throttling never makes it drift (doc 6.4). Also recomputes
 * as soon as the tab becomes visible again.
 */
export function useCountdown(timer, { onZero } = {}) {
  const [remaining, setRemaining] = useState(() => remainingMs(timer));
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const r = remainingMs(timer);
      setRemaining(r);
      if (r === 0 && timer?.status === 'running' && !fired) { fired = true; onZero?.(timer); }
    };
    tick();
    const id = setInterval(tick, 250);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', tick); };
  }, [timer?.id, timer?.status, timer?.endAt, timer?.pausedRemainingMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return { remaining, total: segmentTotal(timer), progress: progressOf(timer, remaining) };
}

/** Length of the current segment (after an extension, the ring restarts). */
export function segmentTotal(timer) {
  if (!timer) return 0;
  const planned = timer.demo ? 30000 : timer.plannedMinutes * 60000;
  if (timer.status === 'paused') return planned;
  const lastExt = (timer.extensions || []).at(-1);
  const from = new Date(lastExt?.at || timer.startAt).getTime();
  return Math.max(1000, new Date(timer.endAt).getTime() - from);
}
const progressOf = (timer, remaining) => {
  const total = segmentTotal(timer);
  return total ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
};

/**
 * Calls `onZero` once when a running timer reaches its end, without
 * re-rendering every tick (used once at the app root).
 */
export function useZeroWatcher(timer, onZero) {
  useEffect(() => {
    if (!timer || timer.status !== 'running') return undefined;
    let fired = false;
    const check = () => {
      if (!fired && remainingMs(timer) === 0) { fired = true; onZero(timer); }
    };
    check();
    const id = setInterval(check, 500);
    const vis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [timer?.id, timer?.status, timer?.endAt]); // eslint-disable-line react-hooks/exhaustive-deps
}
