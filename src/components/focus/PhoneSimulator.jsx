import { Heart, Lock, MessageCircle, Moon, Play, Send, Timer as TimerIcon, Trophy } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown.js';
import { backToFocus } from '../../services/timerActions.js';
import { useAppStore } from '../../store/useAppStore.js';
import { formatCountdown } from '../../utils/time.js';
import { PhoneFrame } from '../layout/PhoneFrame.jsx';
import { ProgressRing } from '../ui/ProgressRing.jsx';

/**
 * Simulated phone for the demo (doc 6.5): during a break it shows a generic
 * social feed; when the break ends it turns dark (Focus mode) with the same
 * Break Over message. A website cannot control real apps — this is a
 * clearly labelled simulation; real blocking arrives with the Android app.
 */
export function PhoneSimulator({ timer, width = 280, showLabel = true }) {
  const user = useAppStore((s) => s.user);
  const { remaining, progress } = useCountdown(timer);
  const state = !timer ? 'home' : timer.kind === 'break' ? (timer.status === 'ended' ? 'locked' : 'feed') : 'focus';
  return (
    <figure className="flex flex-col items-center gap-3">
      <PhoneFrame dark={state !== 'home'} width={width}>
        {state === 'home' && <PhoneHome name={user?.name} />}
        {state === 'feed' && <PhoneFeed remaining={remaining} />}
        {state === 'focus' && <PhoneFocus remaining={remaining} progress={progress} paused={timer.status === 'paused'} />}
        {state === 'locked' && <PhoneLocked />}
      </PhoneFrame>
      {showLabel && <figcaption className="muted max-w-[260px] text-center text-xs">Simulated phone · Real app blocking comes with the Android app</figcaption>}
    </figure>
  );
}

function PhoneHome({ name = 'Friend' }) {
  return (
    <div className="flex h-full flex-col px-4 pt-3">
      <p className="font-display text-lg font-bold">Hello, {name.split(' ')[0]}!</p>
      <p className="text-xs text-ink-soft">Ready to focus today?</p>
      <div className="mt-4 grid place-items-center rounded-2xl bg-white p-4 shadow-soft">
        <ProgressRing value={0.68} inner={0.55} size={120} stroke={10}><span className="font-display text-lg font-bold">Ready</span></ProgressRing>
      </div>
      <div className="mt-3 rounded-2xl bg-white p-3 text-xs shadow-soft">
        <p className="font-semibold">Today's goals</p>
        <p className="mt-1 text-ink-soft">☐ Complete 2 focus sessions</p>
        <p className="text-ink-soft">☐ Keep screen time under 4h</p>
      </div>
      <div className="mt-auto grid grid-cols-4 border-t border-slate-200 bg-white py-2 text-[10px] text-ink-soft">
        {[[TimerIcon, 'Timer'], [Moon, 'Sleep'], [Trophy, 'Wins'], [Lock, 'Lock']].map(([I, l]) => <span key={l} className="flex flex-col items-center gap-0.5"><I className="h-4 w-4" />{l}</span>)}
      </div>
    </div>
  );
}

function PhoneFeed({ remaining }) {
  return (
    <div className="relative h-full">
      <img src="/demo/feed.jpg" alt="A generic short-video feed (demo)" className="h-full w-full object-cover" />
      <div className="absolute left-3 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        Break · {formatCountdown(remaining)}
      </div>
      <div className="absolute bottom-16 right-3 flex flex-col gap-3 text-white" aria-hidden>
        <Heart className="h-6 w-6 fill-rose-400 text-rose-400" /><MessageCircle className="h-6 w-6" /><Send className="h-6 w-6" />
      </div>
    </div>
  );
}

function PhoneFocus({ remaining, progress, paused }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-5 text-center">
      <ProgressRing value={1 - progress} inner={1 - progress} size={150} stroke={10} track="#1e293b">
        <Lock className="h-12 w-12 text-teal" aria-hidden />
      </ProgressRing>
      <p className="font-display text-xl font-bold leading-snug">Focus time.<br /><span className="text-sky">Instagram</span> is paused.</p>
      <p className="text-sm text-slate-400 tabular-nums">{paused ? 'Paused' : `${formatCountdown(remaining)} left`}</p>
      <span className="w-full rounded-full border border-red-400/50 py-2 text-sm text-slate-300">Emergency override</span>
    </div>
  );
}

function PhoneLocked() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-5 text-center">
      <div className="relative grid h-36 w-36 place-items-center">
        <span className="absolute inset-0 rounded-full border-[6px] border-teal/60 animate-pulseRing" />
        <span className="absolute inset-3 rounded-full border-[5px] border-sky/70 animate-pulseRing [animation-delay:300ms]" />
        <Lock className="h-12 w-12 text-teal" aria-hidden />
      </div>
      <p className="font-display text-xl font-bold leading-snug"><span className="text-teal-300">Break over.</span><br />Time to get back to focus.</p>
      <button type="button" onClick={() => backToFocus()} className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-2.5 text-sm font-semibold text-white">
        <Play className="h-4 w-4 fill-white" /> Back to focus
      </button>
      <span className="w-full rounded-full border border-red-400/50 py-2 text-sm text-slate-300">Emergency override</span>
    </div>
  );
}
