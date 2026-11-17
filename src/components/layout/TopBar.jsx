import { CloudOff, Download, Flame, Laptop, Moon, Smartphone, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme.js';
import { api } from '../../services/api.js';
import { promptInstall } from '../../services/pwa.js';
import { useAppStore } from '../../store/useAppStore.js';
import { useProgressStore } from '../../store/useProgressStore.js';
import { cn } from '../../utils/cn.js';
import { Avatar } from '../ui/Avatar.jsx';

/** Greeting, streak, theme toggle and device status (doc 5.3). */
export function TopBar({ title, subtitle }) {
  const user = useAppStore((s) => s.user);
  const mode = useAppStore((s) => s.mode);
  const online = useAppStore((s) => s.online);
  const sync = useAppStore((s) => s.sync);
  const install = useAppStore((s) => s.install);
  const setTheme = useAppStore((s) => s.setTheme);
  const patchUser = useAppStore((s) => s.patchUser);
  const streak = useProgressStore((s) => s.streakDays);
  const resolved = useTheme();

  const toggleTheme = (t) => {
    setTheme(t);
    patchUser({ theme: t });
    // Save to the profile too, otherwise the saved theme is restored on reload.
    api.updateProfile({ theme: t }).catch(() => {});
  };

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pb-2 pt-[calc(1rem+var(--safe-top))] sm:px-6 lg:px-8 lg:pt-7">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[26px] font-bold leading-tight text-ink dark:text-white sm:text-[32px] lg:text-[38px]">{title}</h1>
          {streak > 0 && (
            <span className="pill text-ink dark:text-slate-100" title="Days in a row with a healthy action">
              <Flame className="h-4 w-4 fill-orange-400 text-orange-500" aria-hidden /> {streak}-day streak
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 font-display text-lg font-semibold text-ink-soft dark:text-slate-300 sm:text-2xl lg:text-[30px] lg:leading-tight lg:text-ink lg:dark:text-white">{subtitle}</p>}
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          {install.canPrompt && !install.installed && (
            <button type="button" onClick={promptInstall} className="hidden items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-sm font-semibold text-white shadow-soft sm:inline-flex">
              <Download className="h-4 w-4" /> Install app
            </button>
          )}
          <div className="flex rounded-full bg-slate-600 p-1 dark:bg-slate-700" role="group" aria-label="Theme">
            <button type="button" onClick={() => toggleTheme('light')} aria-pressed={resolved === 'light'} aria-label="Light theme"
              className={cn('grid h-8 w-8 place-items-center rounded-full transition', resolved === 'light' ? 'bg-white text-ink' : 'text-slate-300 hover:text-white')}>
              <Sun className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => toggleTheme('dark')} aria-pressed={resolved === 'dark'} aria-label="Dark theme"
              className={cn('grid h-8 w-8 place-items-center rounded-full transition', resolved === 'dark' ? 'bg-slate-900 text-white' : 'text-slate-300 hover:text-white')}>
              <Moon className="h-4 w-4" />
            </button>
          </div>
          <Link to="/settings" aria-label="Your profile and settings">
            <Avatar name={user?.name} size={48} online={mode === 'account' ? sync.status === 'connected' : online} />
          </Link>
        </div>
        <DeviceChip mode={mode} online={online} sync={sync} />
      </div>
    </header>
  );
}

function DeviceChip({ mode, online, sync }) {
  let icon = Laptop, text = 'This device only', tone = 'bg-slate-100 text-ink-soft dark:bg-slate-800 dark:text-slate-300';
  if (!online) { icon = CloudOff; text = 'Offline'; tone = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'; }
  else if (mode === 'account') {
    if (sync.status === 'connected') { icon = Smartphone; text = 'Devices synced'; tone = 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-100'; }
    else if (sync.status === 'connecting') { icon = Smartphone; text = 'Connecting…'; }
    else { icon = CloudOff; text = 'Sync paused'; tone = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'; }
  }
  const Icon = icon;
  return (
    <Link to="/phone" className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', tone)} aria-label={`Device status: ${text}`}>
      <Icon className="h-4 w-4" aria-hidden /> {text}
    </Link>
  );
}
