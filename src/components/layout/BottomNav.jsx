import { House, Moon, Ellipsis, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn.js';
import { MoreSheet } from './MoreSheet.jsx';

/** Phone navigation (doc 5.4, screen 13): Home, Timer, Sleep, Wins, More. */
const items = [
  { to: '/', label: 'Home', icon: House },
  { to: '/focus', label: 'Timer', icon: Timer },
  { to: '/sleep', label: 'Sleep', icon: Moon },
  { to: '/wins', label: 'Wins', icon: Trophy },
];

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = !items.some((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)));
  return (
    <>
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-light bg-white/95 backdrop-blur dark:border-line-dark dark:bg-card-dark/95 lg:hidden" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium', isActive ? 'text-teal' : 'text-ink-soft dark:text-slate-400')}>
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-teal" aria-hidden />}
                    <Icon className={cn('h-6 w-6', isActive && 'fill-teal/15')} aria-hidden />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn('relative flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-medium', moreActive ? 'text-teal' : 'text-ink-soft dark:text-slate-400')}>
              {moreActive && <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-teal" aria-hidden />}
              <Ellipsis className="h-6 w-6" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
