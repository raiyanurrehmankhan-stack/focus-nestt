import { cn } from '../../utils/cn.js';

export function Avatar({ name = 'Friend', size = 44, online, className }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'F';
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-sky-500 font-display font-semibold text-white ring-4 ring-white dark:ring-slate-800', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials}
      {online != null && <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-800', online ? 'bg-success' : 'bg-slate-400')} />}
    </span>
  );
}
