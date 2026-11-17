import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';

/** Resolves Auto (dark 7 PM–6 AM), Light, Dark or System (doc 6.7). */
export function resolveTheme(theme, date = new Date()) {
  if (theme === 'dark' || theme === 'light') return theme;
  if (theme === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const h = date.getHours();
  return h >= 19 || h < 6 ? 'dark' : 'light';
}

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(theme));
  useEffect(() => {
    const apply = () => setResolved(resolveTheme(theme));
    apply();
    const id = theme === 'auto' ? setInterval(apply, 60 * 1000) : null; // Auto re-checks every minute
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (theme === 'system') mq?.addEventListener?.('change', apply);
    return () => { if (id) clearInterval(id); mq?.removeEventListener?.('change', apply); };
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0F172A' : '#2A9D8F');
  }, [resolved]);
  return resolved;
}
