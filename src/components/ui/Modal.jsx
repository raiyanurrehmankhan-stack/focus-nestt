import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn.js';

/** Accessible modal: focus trap, Escape to close, scroll lock. */
export function Modal({ open, onClose, title, children, className, dismissible = true, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const overflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const wasInert = root?.hasAttribute('inert');
    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    const t = setTimeout(() => ref.current?.querySelector('input,textarea,button:not([data-close]),[tabindex]')?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
      if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll('button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; if (!wasInert) root?.removeAttribute('inert'); prev?.focus?.(); };
  }, [open, dismissible, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy || (title ? 'modal-title' : undefined)}
        className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-lift animate-fadeIn dark:bg-card-dark sm:max-w-lg sm:rounded-3xl', className)}
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}>
        {(title || dismissible) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            {title ? <h2 id="modal-title" className="font-display text-xl font-semibold">{title}</h2> : <span />}
            {dismissible && (
              <button type="button" data-close onClick={onClose} className="-m-2 rounded-full p-2 text-ink-mute hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
