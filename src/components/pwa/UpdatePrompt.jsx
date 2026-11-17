import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { applyUpdate } from '../../services/pwa.js';
import { useAppStore } from '../../store/useAppStore.js';
import { useTimerStore } from '../../store/useTimerStore.js';
import { Button } from '../ui/Button.jsx';

/**
 * Shown when a new deployment is downloaded and waiting. Updating never
 * interrupts the user: they choose when to reload. Timers are stored by end
 * timestamp, so a running session survives the reload.
 */
export function UpdatePrompt() {
  const available = useAppStore((s) => s.update.available);
  const running = useTimerStore((s) => Boolean(s.active));
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!available || hidden) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(0.75rem+var(--safe-top))] z-[75] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lift animate-fadeIn dark:bg-slate-700 lg:left-auto lg:right-6">
      <RefreshCw className="h-5 w-5 shrink-0 text-teal-300" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-semibold">A new version of FocusNest is ready</p>
        <p className="text-slate-300">{running ? 'Your timer will keep running after the update.' : 'Refresh to get the latest improvements.'}</p>
      </div>
      <Button size="sm" variant="white" loading={busy} onClick={() => { setBusy(true); applyUpdate(); }}>Update</Button>
      <button type="button" onClick={() => setHidden(true)} className="rounded-full p-1 text-slate-300 hover:text-white" aria-label="Later"><X className="h-4 w-4" /></button>
    </div>
  );
}
