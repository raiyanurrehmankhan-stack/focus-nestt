import { formatClock, toDateKey } from '@shared/rules.js';

export { formatClock, toDateKey };
export const todayKey = () => toDateKey();

/** 1500000 -> "25:00", 3725000 -> "1:02:05" */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(h ? 2 : 2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 2.75 -> "2h 45m" */
export function formatHours(hours) {
  if (hours == null || Number.isNaN(Number(hours))) return '—';
  const total = Math.round(Number(hours) * 60);
  const h = Math.floor(total / 60), m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const formatMinutes = (min) => (min >= 60 ? formatHours(min / 60) : `${Math.round(min)} min`);

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const relativeDay = (key) => {
  const t = toDateKey();
  if (key === t) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (key === toDateKey(y)) return 'Yesterday';
  return shortDate(key);
};
