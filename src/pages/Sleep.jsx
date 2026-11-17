import { ChevronRight, Clock, Lock, Moon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WIND_DOWN_CHECKLIST } from '@shared/constants.js';
import { addDays, timeToMinutes, toDateKey } from '@shared/rules.js';
import { SleepChart } from '../components/charts/SleepChart.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { ProgressRing } from '../components/ui/ProgressRing.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { useTheme } from '../hooks/useTheme.js';
import { api } from '../services/api.js';
import { invalidate } from '../services/events.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { formatClock, formatCountdown, todayKey } from '../utils/time.js';

/** Screen 6: Sleep and bedtime mode (feature F6). */
export default function Sleep() {
  const dark = useTheme() === 'dark';
  const user = useAppStore((s) => s.user);
  const patchUser = useAppStore((s) => s.patchUser);
  const applyProgress = useProgressStore((s) => s.apply);
  const { data, loading, setData } = useApiData(() => api.getSleepWeek(todayKey()), [], { keys: ['sleep'] });
  const [goal, setGoal] = useState(user?.bedtimeGoal || '23:00');
  const [wake, setWake] = useState(user?.wakeGoal || '07:00');
  const [morning, setMorning] = useState({ actualBedtime: '', hoursSlept: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data?.bedtimeGoal) setGoal(data.bedtimeGoal); }, [data?.bedtimeGoal]);

  const saveGoal = async () => {
    try {
      await api.updateProfile({ bedtimeGoal: goal, wakeGoal: wake });
      patchUser({ bedtimeGoal: goal, wakeGoal: wake });
      toast.success(`Bedtime goal set to ${formatClock(goal)}`);
    } catch (err) { toast.error(err.message); }
  };

  const toggleItem = async (id) => {
    const done = data?.today?.checklistDone || [];
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setData((d) => ({ ...d, today: { ...(d.today || { date: todayKey() }), checklistDone: next } }));
    try {
      await api.saveSleep({ date: todayKey(), checklistDone: next, bedtimeGoal: goal });
      if (next.length === WIND_DOWN_CHECKLIST.length) toast.success('Wind-down complete. Sleep well 🌙');
    } catch (err) { toast.error(err.message); invalidate('sleep'); }
  };

  // Morning check-in: logs LAST night (yesterday's date).
  const saveMorning = async (e) => {
    e.preventDefault();
    if (!morning.actualBedtime) { toast.error('Add the time you went to bed'); return; }
    setBusy(true);
    try {
      const night = addDays(todayKey(), -1);
      const res = await api.saveSleep({ date: night, actualBedtime: morning.actualBedtime, bedtimeGoal: goal, ...(morning.hoursSlept !== '' ? { hoursSlept: Number(morning.hoursSlept) } : {}) });
      applyProgress(res.progress);
      toast[res.points ? 'points' : 'success'](res.points ? `On target! +${res.points} points and a sleep streak day 🌙` : 'Logged. Every night is a new chance.');
      setMorning({ actualBedtime: '', hoursSlept: '' });
      invalidate('sleep', 'dashboard', 'quests');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  if (loading && !data) return <div className="page grid gap-5 lg:grid-cols-2"><CardSkeleton lines={3} /><CardSkeleton lines={3} /><CardSkeleton lines={6} /><CardSkeleton lines={6} /></div>;
  const done = data?.today?.checklistDone || [];

  return (
    <div className="page grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Bedtime Goal" icon={Clock} />
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-sky-50 p-4 dark:bg-slate-800">
            <div>
              <label htmlFor="bed-goal" className="label">Bedtime</label>
              <input id="bed-goal" type="time" className="field w-[150px]" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div>
              <label htmlFor="wake-goal" className="label">Wake up</label>
              <input id="wake-goal" type="time" className="field w-[150px]" value={wake} onChange={(e) => setWake(e.target.value)} />
            </div>
            <Button onClick={saveGoal}>Save</Button>
          </div>
          <p className="muted mt-3 text-sm">Goal: {formatClock(goal)} – {formatClock(wake)}. In bed within 30 minutes of your goal earns +10 points.</p>
        </Card>
        <WindDown goal={goal} />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Your wind-down checklist" subtitle="Tick them off tonight" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {WIND_DOWN_CHECKLIST.map((c) => (
              <li key={c.id}>
                <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 ring-1 transition', done.includes(c.id) ? 'bg-teal-50 ring-teal/40 dark:bg-teal-900/30' : 'ring-line-light dark:ring-line-dark')}>
                  <input type="checkbox" className="h-5 w-5 accent-teal" checked={done.includes(c.id)} onChange={() => toggleItem(c.id)} />
                  <span className="flex-1 text-lg">{c.label}</span><span aria-hidden>{c.emoji}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
        <StreakCalendar history={data?.history || []} streak={data?.streak || 0} />
      </div>

      <Card>
        <CardHeader title="Good morning! How did you sleep?" subtitle="Log last night to keep your streak" icon={Moon} />
        <form onSubmit={saveMorning} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="mc-bed" className="label">I went to bed at</label>
            <input id="mc-bed" type="time" className="field w-[150px]" value={morning.actualBedtime} onChange={(e) => setMorning({ ...morning, actualBedtime: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="mc-hours" className="label">Hours slept</label>
            <input id="mc-hours" type="number" min="0" max="16" step="0.5" className="field w-[120px]" value={morning.hoursSlept} onChange={(e) => setMorning({ ...morning, hoursSlept: e.target.value })} placeholder="7.5" />
          </div>
          <Button type="submit" loading={busy}>Save</Button>
        </form>
        <div className="mt-5"><SleepChart data={data?.week || []} dark={dark} /></div>
      </Card>

      <Link to="/night-lock" className="card group flex items-center gap-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white dark:from-slate-800 dark:to-slate-950">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><Lock className="h-7 w-7 text-teal-300" /></span>
        <div className="flex-1">
          <p className="font-display text-xl font-semibold">Night Lock</p>
          <p className="text-sm text-slate-300">Choose apps to pause at bedtime. Preview now — full blocking arrives with the Android app.</p>
        </div>
        <ChevronRight className="h-6 w-6 transition group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

/** Countdown to the start of wind-down (30 minutes before bedtime). */
function WindDown({ goal }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const target = useMemo(() => {
    const m = timeToMinutes(goal) ?? 23 * 60;
    const d = new Date(now);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    if (d.getTime() - now < -60 * 60 * 1000) d.setDate(d.getDate() + 1); // goal already passed by >1h: next night
    return d.getTime();
  }, [goal, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = target - now;
  const inWindow = left <= 30 * 60 * 1000 && left > 0;
  const past = left <= 0;
  const progress = Math.max(0, Math.min(1, 1 - left / (6 * 3600 * 1000)));
  const [reminder, setReminder] = useState(false);
  return (
    <Card className="flex flex-col items-center">
      <CardHeader className="w-full" title="Wind-down Countdown" action={<Moon className="h-6 w-6 fill-slate-600 text-slate-600 dark:fill-slate-300 dark:text-slate-300" />} />
      <ProgressRing value={progress} inner={inWindow ? 1 - left / (30 * 60 * 1000) : progress * 0.9} size={220} stroke={16} color="#1C665D" innerColor="#4F8EF7" label="Time until your bedtime goal">
        <div>
          <div className="font-display text-4xl font-bold tabular-nums">{past ? 'Bedtime' : formatCountdown(left)}</div>
          <div className="muted text-sm">{past ? 'Phone down, lights low 🌙' : 'to your goal 🌙'}</div>
        </div>
      </ProgressRing>
      <p className={cn('mt-3 text-center text-sm', inWindow ? 'font-semibold text-sky-600 dark:text-sky-300' : 'muted')}>{inWindow ? 'Wind-down time: start your checklist now.' : `Wind-down starts 30 minutes before ${formatClock(goal)}.`}</p>
      <Toggle className="mt-4 w-full" label="Remind me at wind-down" description="Uses a notification on this device" checked={reminder}
        onChange={async (on) => {
          setReminder(on);
          if (on && 'Notification' in window && Notification.permission !== 'granted') {
            const p = await Notification.requestPermission().catch(() => 'denied');
            if (p !== 'granted') { setReminder(false); toast.info('Allow notifications in your browser to get bedtime reminders.'); return; }
          }
          if (on) scheduleWindDown(target);
        }} />
    </Card>
  );
}

let windDownTimer = null;
function scheduleWindDown(bedtimeMs) {
  clearTimeout(windDownTimer);
  const at = bedtimeMs - 30 * 60 * 1000 - Date.now();
  if (at <= 0) return;
  windDownTimer = setTimeout(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body: 'Wind-down time: charger away, teeth, alarm, no screens.', icon: '/icons/icon-192.png', tag: 'wind-down', data: { url: '/sleep' } };
    if (reg) reg.showNotification('Time to wind down 🌙', opts); else new Notification('Time to wind down 🌙', opts); // eslint-disable-line no-new
  }, Math.min(at, 2 ** 31 - 1));
  toast.success('Reminder set for tonight (keep FocusNest open in a tab or installed).');
}

function StreakCalendar({ history, streak }) {
  const good = new Set(history.filter((h) => h.onTarget).map((h) => h.date));
  const logged = new Set(history.map((h) => h.date));
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => toDateKey(new Date(now.getFullYear(), now.getMonth(), i + 1)))];
  const today = todayKey();
  return (
    <Card>
      <CardHeader title="Sleep Streak Calendar" action={<span className="chip">🪺 {streak}-day sleep streak</span>} />
      <p className="muted -mt-2 mb-3 text-sm">{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
      <div className="grid grid-cols-7 gap-y-1.5 text-center text-sm" role="grid" aria-label="Sleep streak calendar">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="pb-1 font-semibold" role="columnheader">{d}</div>)}
        {cells.map((key, i) => {
          if (!key) return <div key={`b${i}`} />;
          const on = good.has(key);
          const prevOn = on && good.has(addDays(key, -1)) && new Date(`${key}T12:00`).getDay() !== 0;
          const nextOn = on && good.has(addDays(key, 1)) && new Date(`${key}T12:00`).getDay() !== 6;
          return (
            <div key={key} role="gridcell" aria-label={`${key}${on ? ', on target' : logged.has(key) ? ', logged' : ''}`}
              className={cn('py-1.5', on && 'bg-teal text-white', on && !prevOn && 'rounded-l-full', on && !nextOn && 'rounded-r-full', !on && logged.has(key) && 'text-sky-600 underline decoration-dotted', key === today && 'font-bold ring-2 ring-inset ring-sky rounded-full')}>
              {Number(key.slice(8))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
