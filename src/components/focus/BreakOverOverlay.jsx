import { Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { backToFocus } from '../../services/timerActions.js';
import { useTimerStore } from '../../store/useTimerStore.js';
import { Button } from '../ui/Button.jsx';
import { ExtendPanel } from './ExtendModal.jsx';

/**
 * Break Over (doc 5.4, screen 4): full-screen overlay with a gentle pulse.
 * It needs a decision — Back to focus, or 5 more minutes after a pause.
 */
export function BreakOverOverlay({ timer }) {
  const extendOpen = useTimerStore((s) => s.extendOpen);
  const setExtendOpen = useTimerStore((s) => s.setExtendOpen);
  const busy = useTimerStore((s) => s.busy);
  const primary = useRef(null);
  const canExtend = (timer.extensionsLeft ?? 0) > 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    const root = document.getElementById('root');
    document.body.style.overflow = 'hidden';
    // The page behind the overlay is unreachable for keyboard and screen readers.
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    primary.current?.focus();
    return () => { document.body.style.overflow = prev; root?.removeAttribute('inert'); root?.removeAttribute('aria-hidden'); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-slate-900/70 px-5 py-8 text-center text-white backdrop-blur-md" role="alertdialog" aria-modal="true" aria-labelledby="break-over-title" aria-describedby="break-over-desc">
      <p className="absolute left-0 right-0 top-[calc(1.25rem+var(--safe-top))] font-display text-xl font-bold"><span>Focus</span><span className="text-sky-300">Nest</span></p>
      <div className="relative mb-6 grid place-items-center" style={{ width: 260, height: 260 }}>
        <span className="absolute inset-0 rounded-full border-[10px] border-teal/50 animate-pulseRing" aria-hidden />
        <span className="absolute inset-4 rounded-full border-[8px] border-sky/70 animate-pulseRing [animation-delay:400ms]" aria-hidden />
        <span className="absolute inset-[-14px] rounded-full border-2 border-teal/30 animate-pulseRing [animation-delay:800ms]" aria-hidden />
        <div className={`grid h-40 w-40 place-items-center rounded-full bg-teal-100/90 shadow-glow ${extendOpen ? 'animate-breathe' : ''}`}>
          <img src="/brand/logo-icon-160.png" alt="" className="h-28 w-28" />
        </div>
      </div>

      {!extendOpen ? (
        <>
          <h2 id="break-over-title" className="max-w-md font-display text-3xl font-bold leading-tight sm:text-4xl">
            <span className="text-teal-300">Break over.</span> Time to get back to focus.
          </h2>
          <p id="break-over-desc" className="mt-3 max-w-sm text-slate-200">Your break did its job. Your next small step is waiting.</p>
          <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
            <Button ref={primary} size="lg" loading={busy} onClick={() => backToFocus()} className="w-full">
              Back to focus <Play className="h-5 w-5 fill-white" aria-hidden />
            </Button>
            <Button size="lg" variant="outline-light" className="w-full" disabled={!canExtend || busy} onClick={() => setExtendOpen(true)}>
              {canExtend ? '5 more minutes' : 'No extensions left'}
            </Button>
            {canExtend && <p className="text-xs text-slate-300">{timer.extensionsLeft} of 2 extensions left for this break</p>}
          </div>
        </>
      ) : (
        <ExtendPanel timer={timer} onCancel={() => setExtendOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
