import { CircleCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAIN_APPS, MOODS } from '@shared/constants.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { invalidate } from '../services/events.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { formatClock, formatHours, relativeDay, todayKey } from '../utils/time.js';

/** Screen 5: Daily check-in (feature F5) — a 10-second form. */
export default function CheckIn() {
  const user = useAppStore((s) => s.user);
  const offline = useAppStore((s) => !s.online && s.mode === 'account');
  const applyProgress = useProgressStore((s) => s.apply);
  const history = useApiData(() => api.listCheckIns({}), [], { keys: ['checkin'] });
  const today = history.data?.items?.find((c) => c.date === todayKey());
  const [form, setForm] = useState({ screenHours: 3, mainApps: [], bedtime: user?.bedtimeGoal || '23:30', mood: 'okay' });
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (today) setForm({ screenHours: today.screenHours, mainApps: today.mainApps || [], bedtime: today.bedtime, mood: today.mood });
  }, [today?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api.saveCheckIn({ date: todayKey(), ...form, screenHours: Number(form.screenHours) });
      applyProgress(res.progress);
      setSaved(res.checkIn);
      invalidate('checkin', 'dashboard', 'quests');
      toast.success('Check-in saved. Thanks for being honest with yourself.');
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const goal = user?.screenGoalHours || 4;
  const items = history.data?.items || [];

  return (
    <div className="page grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader title={today ? "Update today's check-in" : 'How was today?'} subtitle="Only you can see this." />
        {saved ? (
          <Summary entry={saved} goal={goal} onEdit={() => setSaved(null)} />
        ) : (
          <form onSubmit={save} className="space-y-6">
            <div>
              <label htmlFor="ci-hours" className="label">Phone use today: <strong className="text-teal">{formatHours(form.screenHours)}</strong></label>
              <input id="ci-hours" type="range" min="0" max="16" step="0.25" value={form.screenHours} onChange={(e) => setForm({ ...form, screenHours: Number(e.target.value) })} className="w-full accent-teal" />
              <div className="muted flex justify-between text-xs"><span>0h</span><span>Your goal: {formatHours(goal)}</span><span>16h</span></div>
              {errors.screenHours && <p className="field-error">{errors.screenHours}</p>}
            </div>
            <fieldset>
              <legend className="label">Main apps</legend>
              <div className="flex flex-wrap gap-2">
                {MAIN_APPS.map((app) => {
                  const on = form.mainApps.includes(app);
                  return (
                    <button key={app} type="button" aria-pressed={on} onClick={() => setForm({ ...form, mainApps: on ? form.mainApps.filter((a) => a !== app) : [...form.mainApps, app] })}
                      className={cn('rounded-full px-4 py-2 text-sm font-semibold ring-1 transition', on ? 'bg-teal text-white ring-teal' : 'bg-white ring-line-light hover:ring-teal/50 dark:bg-slate-800 dark:ring-line-dark')}>{app}</button>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <label htmlFor="ci-bed" className="label">When did you put the phone down last night?</label>
              <input id="ci-bed" type="time" className="field max-w-[180px]" required value={form.bedtime} onChange={(e) => setForm({ ...form, bedtime: e.target.value })} />
              {errors.bedtime && <p className="field-error">{errors.bedtime}</p>}
            </div>
            <fieldset>
              <legend className="label">Mood</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {MOODS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={form.mood === m.id} onClick={() => setForm({ ...form, mood: m.id })}
                    className={cn('flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-medium ring-2 transition', form.mood === m.id ? 'bg-teal-50 ring-teal dark:bg-teal-900/40' : 'bg-canvas-light ring-transparent hover:ring-teal/30 dark:bg-slate-800')}>
                    <span className="text-2xl" aria-hidden>{m.emoji}</span>{m.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy} disabled={offline}>Save check-in</Button>
            <p className="muted text-xs">FocusNest can't see inside other apps — these numbers come only from you. Mood stays private.</p>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent check-ins" />
        {history.loading && !history.data ? <CardSkeleton lines={4} className="p-0 shadow-none" />
          : items.length === 0 ? <EmptyState title="No check-ins yet" message="Your first check-in starts your weekly chart." mascot="tangled" size={80} />
            : (
              <ul className="space-y-2">
                {items.slice(0, 10).map((c) => (
                  <li key={c.date} className="list-row">
                    <div>
                      <p className="font-semibold">{relativeDay(c.date)}</p>
                      <p className="muted text-xs">{(c.mainApps || []).join(', ') || 'No apps noted'} · phone down {formatClock(c.bedtime)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('font-display text-lg font-bold', c.screenHours > goal ? 'text-danger' : 'text-teal')}>{formatHours(c.screenHours)}</p>
                      <p className="text-lg" aria-label={MOODS.find((m) => m.id === c.mood)?.label}>{MOODS.find((m) => m.id === c.mood)?.emoji}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
      </Card>
    </div>
  );
}

function Summary({ entry, goal, onEdit }) {
  const under = entry.screenHours <= goal;
  return (
    <div className="flex flex-col items-center py-4 text-center animate-fadeIn">
      <CircleCheck className="h-14 w-14 text-success" aria-hidden />
      <h3 className="mt-3 font-display text-2xl font-bold">Saved!</h3>
      <p className="muted mt-1">{formatHours(entry.screenHours)} today · {MOODS.find((m) => m.id === entry.mood)?.emoji} {MOODS.find((m) => m.id === entry.mood)?.label}</p>
      <p className="mt-4 max-w-sm">{under ? `You stayed under your ${formatHours(goal)} goal. That's a win worth writing down.` : `A bit over your ${formatHours(goal)} goal. Tomorrow, try a break timer before your danger time.`}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to={under ? '/wins' : '/activities'} className="rounded-full bg-teal px-5 py-2.5 font-semibold text-white">{under ? 'Add to My Wins' : 'Find an offline activity'}</Link>
        <Button variant="ghost" onClick={onEdit}>Edit</Button>
      </div>
    </div>
  );
}
