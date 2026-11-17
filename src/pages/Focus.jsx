import { Coffee, Maximize2, Minimize2, Pause, Play, Square, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PhoneSimulator } from '../components/focus/PhoneSimulator.jsx';
import { TimerCircle } from '../components/focus/TimerCircle.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Mascot } from '../components/ui/Mascot.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { cancelFocus, endBreakNow, pauseFocus, refreshTimer, startBreak, startFocus } from '../services/timerActions.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { todayKey } from '../utils/time.js';

/** Screen 3: Focus and Break (features F3, F4, F14). */
export default function Focus() {
  const user = useAppStore((s) => s.user);
  const mode = useAppStore((s) => s.mode);
  const sync = useAppStore((s) => s.sync);
  const patchUser = useAppStore((s) => s.patchUser);
  const active = useTimerStore((s) => s.active);
  const busy = useTimerStore((s) => s.busy);
  const points = useProgressStore((s) => s.points);
  const [goal, setGoal] = useState(active?.goalText || '');
  const [minutes, setMinutes] = useState(25);
  const [full, setFull] = useState(false);
  const [params, setParams] = useSearchParams();
  const area = useRef(null);
  const sessions = useApiData(() => api.todaySessions(todayKey()), [], { keys: ['focus'] });

  const breakMinutes = user?.defaultBreakMinutes || 30;
  const demo = Boolean(user?.demoMode);
  const isFocus = active?.kind === 'focus';
  const isBreak = active?.kind === 'break';

  // Shortcuts from the installed app (manifest shortcuts) and notification clicks.
  useEffect(() => {
    const start = params.get('start');
    if (params.get('breakOver')) refreshTimer();
    if (start && !active) (start === 'break' ? startBreak() : startFocus({ goalText: goal, minutes }));
    if (start || params.get('breakOver')) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Space starts or pauses the focus timer (doc 6.7).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      if (!active) startFocus({ goalText: goal, minutes });
      else if (isFocus) pauseFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, isFocus, goal, minutes]);

  // Distraction-free full-screen mode.
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (area.current?.requestFullscreen) await area.current.requestFullscreen();
      else setFull((f) => !f);
    } catch { setFull((f) => !f); }
  };

  const setDemo = async (on) => {
    try {
      await api.updateProfile({ demoMode: on });
      patchUser({ demoMode: on });
      toast.info(on ? 'Demo mode on: timers last 30 seconds' : 'Demo mode off: real timer lengths');
    } catch (err) { toast.error(err.message); }
  };

  const items = sessions.data?.items || [];
  const syncLabel = mode === 'account' ? (sync.status === 'connected' ? 'Phone connected' : 'Phone sync paused') : 'This device only';

  return (
    <div className="page grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div ref={area} className={cn('card flex flex-col items-center gap-6 py-8', full && 'fixed inset-0 z-50 justify-center rounded-none bg-canvas-light dark:bg-canvas-dark')}>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className={cn('chip', mode === 'account' && sync.status !== 'connected' && 'bg-amber-100 text-amber-800')}>{syncLabel}</span>
          <div className="flex items-center gap-2">
            {demo && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><Zap className="h-3.5 w-3.5" /> Demo mode</span>}
            <Button variant="ghost" size="icon" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Distraction-free full screen'}>{full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}</Button>
          </div>
        </div>

        <div className="w-full max-w-xl">
          <label htmlFor="focus-goal" className="font-display text-xl font-semibold">What are you working on?</label>
          <input id="focus-goal" className="field mt-2 h-12 text-base" maxLength={120} placeholder={user?.userType === 'Working professional' ? 'e.g. Quarterly report' : 'e.g. Chapter 4 notes'}
            value={isFocus && active.goalText ? active.goalText : goal} disabled={isFocus} onChange={(e) => setGoal(e.target.value)} />
        </div>

        <TimerCircle timer={active} idleMinutes={demo ? 0.5 : minutes} size={Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 80 : 320)} />

        {!active && (
          <Segmented ariaLabel="Focus length" value={minutes} onChange={setMinutes} options={[{ value: 25, label: '25 min' }, { value: 50, label: '50 min' }, { value: 90, label: '90 min' }]} />
        )}

        <div className="flex w-full max-w-xl flex-wrap justify-center gap-3">
          {!active && (
            <>
              <Button size="lg" className="min-w-[150px]" loading={busy} onClick={() => startFocus({ goalText: goal, minutes })}><Play className="h-5 w-5 fill-white" /> Start</Button>
              <Button size="lg" variant="outline-blue" onClick={() => startBreak({ minutes: breakMinutes })} disabled={busy}><Coffee className="h-5 w-5" /> Take a {demo ? '30 sec' : `${breakMinutes} min`} break</Button>
            </>
          )}
          {isFocus && (
            <>
              <Button size="lg" variant="secondary" className="min-w-[150px]" loading={busy} onClick={pauseFocus}>
                {active.status === 'paused' ? <><Play className="h-5 w-5 fill-white" /> Resume</> : <><Pause className="h-5 w-5" /> Pause</>}
              </Button>
              <Button size="lg" variant="outline-blue" onClick={() => startBreak({ minutes: breakMinutes })} disabled={busy}><Coffee className="h-5 w-5" /> Take a {demo ? '30 sec' : `${breakMinutes} min`} break</Button>
              <Button size="lg" variant="ghost" onClick={cancelFocus} disabled={busy}><Square className="h-4 w-4" /> Stop</Button>
            </>
          )}
          {isBreak && active.status === 'running' && (
            <>
              <Button size="lg" loading={busy} onClick={() => startFocus({ goalText: goal, minutes })}><Play className="h-5 w-5 fill-white" /> Back to focus now</Button>
              <Button size="lg" variant="ghost" onClick={endBreakNow} disabled={busy}>End break</Button>
            </>
          )}
        </div>
        <p className="muted text-center text-xs">Tip: press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">Space</kbd> to start or pause.{isBreak && ' When the break ends you will hear a gentle alarm.'}</p>
      </div>

      <aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
        <Card>
          <CardHeader title="Today's Sessions" />
          {sessions.loading && !sessions.data ? <div className="space-y-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            : items.length === 0 ? <p className="muted text-sm">No sessions yet. Your first one is the hardest — and the best.</p>
              : (
                <ul className="space-y-2">
                  {items.slice(0, 6).map((s) => (
                    <li key={s.id} className="list-row"><span className="truncate">{s.goalText || 'Focus session'} — {s.minutes}m</span><span className="text-sm font-semibold text-teal">+{s.points}</span></li>
                  ))}
                </ul>
              )}
          <div className="mt-4 flex items-center justify-between border-t border-line-light pt-4 dark:border-line-dark">
            <span className="font-display text-lg font-semibold">Total Points</span>
            <span className="flex items-center gap-2"><img src="/brand/logo-icon-160.png" alt="" className="h-9 w-9" /><span className="font-display text-2xl font-bold text-teal">{points}</span></span>
          </div>
        </Card>

        <Card className="flex flex-col items-center text-center">
          <Mascot state={isFocus ? 'loosening' : 'free'} size={92} />
          <p className="mt-2 font-display text-lg font-semibold">{items.length ? `Great job! ${items.length} session${items.length > 1 ? 's' : ''} today` : 'Every session loosens a circle'}</p>
          <p className="muted text-sm">{isFocus ? 'Current focus is strong.' : 'Finish 25 minutes to earn +10 points.'}</p>
          <div className="mt-4 w-full border-t border-line-light pt-4 text-left dark:border-line-dark">
            <Toggle label="Demo mode" description="Turns 30-minute timers into 30 seconds" checked={demo} onChange={setDemo} />
          </div>
        </Card>

        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader title="Your phone" subtitle={mode === 'account' ? 'Open FocusNest on your phone to sync for real' : 'Simulated for the demo'} action={<Link to="/phone" className="text-sm font-semibold text-teal">Open</Link>} />
          <PhoneSimulator timer={active} width={230} />
        </Card>
      </aside>
    </div>
  );
}
