import { useCallback, useEffect, useRef, useState } from 'react';
import { onInvalidate } from '../services/events.js';

/**
 * Loads data through `api` with loading / error states and automatic refresh
 * when one of `keys` is invalidated (after a save, a realtime event, …).
 */
export function useApiData(fetcher, deps = [], { keys = [], initial = null } = {}) {
  const [state, setState] = useState({ data: initial, loading: true, error: null, offline: false });
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchRef.current();
      if (id === seq.current) setState({ data, loading: false, error: null, offline: Boolean(data?._offline) });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, []);

  useEffect(() => { load(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const offs = keys.map((k) => onInvalidate(k, () => load({ silent: true })));
    const all = onInvalidate('*', () => load({ silent: true }));
    return () => { offs.forEach((f) => f()); all(); };
  }, [keys.join('|'), load]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}
