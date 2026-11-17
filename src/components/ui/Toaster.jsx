import { CircleAlert, CircleCheck, Info, Sparkles, X } from 'lucide-react';
import { useToastStore } from '../../store/useToastStore.js';
import { cn } from '../../utils/cn.js';

const styles = {
  success: { icon: CircleCheck, cls: 'text-success' },
  error: { icon: CircleAlert, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-sky' },
  points: { icon: Sparkles, cls: 'text-warning' },
};

/** Plain-language toasts (doc 5.5). Announced to screen readers. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-bottom))] z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const S = styles[t.type] || styles.info;
        return (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift ring-1 ring-black/5 animate-fadeIn dark:bg-slate-800 dark:ring-white/10">
            <S.icon className={cn('mt-0.5 h-5 w-5 shrink-0', S.cls)} aria-hidden />
            <p className="flex-1 text-sm font-medium text-ink dark:text-slate-100">{t.message}</p>
            {t.action && <button type="button" className="text-sm font-semibold text-teal" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-full p-1 text-ink-mute hover:text-ink" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
