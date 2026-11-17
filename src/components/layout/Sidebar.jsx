import { NavLink } from 'react-router-dom';
import { appRoutes } from '../../routes.jsx';
import { cn } from '../../utils/cn.js';
import { Logo } from '../ui/Logo.jsx';

/** Laptop navigation (doc 5.3): icons with labels, active item highlighted. */
export function Sidebar() {
  const items = appRoutes.filter((r) => r.nav === 'main');
  return (
    <aside className="sticky top-0 hidden h-screen w-[108px] shrink-0 flex-col items-center gap-1 overflow-y-auto bg-white py-5 scrollbar-none dark:bg-card-dark lg:flex xl:w-[120px]" aria-label="Main navigation">
      <NavLink to="/" className="mb-4 rounded-2xl p-1" aria-label="FocusNest home">
        <Logo size={52} vertical showText={false} />
        <span className="mt-1 block text-center font-display text-sm font-bold"><span className="text-teal">Focus</span><span className="text-sky">Nest</span></span>
      </NavLink>
      <nav className="flex w-full flex-col gap-1 px-2">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/'}
            className={({ isActive }) => cn(
              'group relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[13px] font-medium transition',
              isActive ? 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-100' : 'text-ink-soft hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
            )}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute -left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-teal" aria-hidden />}
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
