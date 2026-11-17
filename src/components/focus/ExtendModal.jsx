import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LIMITS } from '@shared/constants.js';
import { extendBreak } from '../../services/timerActions.js';
import { useTimerStore } from '../../store/useTimerStore.js';
import { Button } from '../ui/Button.jsx';

/**
 * "Take a breath. Why do you need more time?" (doc 5.4 / image 6):
 * a 30-second breathing pause and a reason before the extension is granted.
 */
export function ExtendPanel({ timer, onCancel }) {
  const pause = timer?.demo ? 5 : LIMITS.pauseSeconds;
  const [left, setLeft] = useState(pause);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const busy = useTimerStore((s) => s.busy);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, pause - Math.floor((Date.now() - start) / 1000));
      setLeft(l);
      if (!l) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [pause]);

  const submit = async (e) => {
    e.preventDefault();
    if (left > 0) return;
    if (reason.trim().length < 3) { setError('Tell yourself why in a few words.'); return; }
    await extendBreak(reason.trim());
  };
  const pct = 1 - left / pause;

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col items-center">
      <h2 id="extend-title" className="font-display text-3xl font-bold leading-tight sm:text-4xl">
        <span className="text-teal-300">Take a breath.</span> Why do you need more time?
      </h2>
      <p className="mt-2 text-sm text-slate-300">Breathe in as the circle grows, out as it shrinks.</p>
      <div className="relative mt-5 w-full">
        <label htmlFor="extend-reason" className="sr-only">Why do you need more time?</label>
        <input id="extend-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} maxLength={200}
          placeholder="I need more time because…" autoComplete="off"
          className="h-12 w-full rounded-full border-0 bg-white pl-5 pr-16 text-ink placeholder:text-ink-mute focus:ring-2 focus:ring-teal" />
        <span className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center" aria-hidden>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke="#2A9D8F" strokeWidth="3" strokeDasharray={94.2} strokeDashoffset={94.2 * (1 - pct)} strokeLinecap="round" /></svg>
          <span className="relative text-[10px] font-bold text-ink">0:{String(left).padStart(2, '0')}</span>
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
      <p className="mt-2 text-sm text-slate-200" aria-live="polite">{left > 0 ? `Button active in ${left}s` : 'You can continue now'}</p>
      <div className="mt-4 grid w-full grid-cols-2 gap-3">
        <Button size="lg" variant="outline-light" onClick={onCancel}>Cancel</Button>
        <Button size="lg" type="submit" disabled={left > 0} loading={busy}>
          {left > 0 && <Lock className="h-4 w-4" aria-hidden />} Submit
        </Button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Adds {timer?.demo ? '30 seconds (demo)' : `${LIMITS.extensionMinutes} minutes`}. Your reason stays private.</p>
    </form>
  );
}
