import { CloudOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.js';

export function OfflineBanner() {
  const online = useAppStore((s) => s.online);
  const mode = useAppStore((s) => s.mode);
  if (online) return null;
  return (
    <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 sm:mx-6 lg:mx-8">
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      {mode === 'account'
        ? "You're offline. You can look around; saving and syncing resume when you're back online."
        : "You're offline. Everything still works — your data is saved on this device."}
    </div>
  );
}
