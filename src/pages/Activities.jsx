import { PartyPopper, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ACTIVITY_CATEGORIES } from '@shared/constants.js';
import { Button } from '../components/ui/Button.jsx';
import { Mascot } from '../components/ui/Mascot.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { invalidate } from '../services/events.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { formatCountdown, shortDate, todayKey } from '../utils/time.js';

/** Screen 10: Offline Activity Finder — "Bored? Try this" (feature F10). */
export default function Activities() {
  const apply = useProgressStore((s) => s.apply);
  const history = useApiData(() => api.activityHistory(), [], { keys: ['activities'] });
  const [category, setCategory] = useState(null);
  const [activity, setActivity] = useState(null);
  const [challengeEnd, setChallengeEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!challengeEnd) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [challengeEnd]);
  const left = challengeEnd ? Math.max(0, challengeEnd - now) : 0;

  const pick = async (cat = category) => {
    try {
      const { activity: a } = await api.randomActivity({ category: cat || undefined, exclude: activity?.id });
      setActivity(a);
      setChallengeEnd(null);
    } catch (err) { toast.error(err.message); }
  };
  const done = async () => {
    if (!activity) return;
    setBusy(true);
    try {
      const res = await api.completeActivity({ date: todayKey(), activityId: activity.id });
      apply(res.progress);
      toast.points(res.points ? `+${res.points} points. Nice offline break! 🌿` : 'Logged! (Activity points are capped at 3 per day.)');
      setChallengeEnd(null);
      invalidate('activities', 'quests', 'dashboard');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-[#1f3a52] via-[#173247] to-[#0f2233] p-5 text-white shadow-lift sm:p-7">
        <div className="pointer-events-none absolute right-10 top-6 h-24 w-24 rounded-full bg-slate-100/80 shadow-[0_0_60px_20px_rgba(255,255,255,0.25)]" aria-hidden />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <div className="relative rounded-2xl bg-white/10 p-6 text-center backdrop-blur">
              <Mascot state="loosening" size={70} className="absolute -left-2 -top-8" />
              <Button size="xl" className="mx-auto" onClick={() => pick()}>Bored? Try this <PartyPopper className="h-6 w-6" /></Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Result Card</h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
                {ACTIVITY_CATEGORIES.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => { const next = category === c ? null : c; setCategory(next); pick(next); }}
                    className={cn('rounded-full px-3.5 py-1 text-sm font-medium transition', category === c ? 'bg-teal text-white' : 'bg-teal-50/90 text-teal-800 hover:bg-white')}>{c}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[#173f47]/90 p-5" aria-live="polite">
              {!activity ? (
                <p className="text-slate-200">Tap <strong>Bored? Try this</strong> for a 15-minute real-world challenge.</p>
              ) : (
                <div className="flex gap-4">
                  <span className="text-5xl" aria-hidden>{activity.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold">{activity.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">{activity.description}</p>
                    <span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-1 text-xs">🔥 +5 Points</span>
                    {challengeEnd && <p className="mt-3 font-display text-3xl font-bold tabular-nums">{left ? formatCountdown(left) : 'Time! 🎉'}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!challengeEnd && <Button onClick={() => setChallengeEnd(Date.now() + (activity.minutes || 15) * 60000)}><Play className="h-4 w-4 fill-white" /> Start {activity.minutes || 15} min challenge</Button>}
                      <Button variant="outline-teal-light" loading={busy} onClick={done}>Done</Button>
                      <Button variant="outline-teal-light" onClick={() => pick()}><RotateCcw className="h-4 w-4" /> Try something else</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-2xl bg-[#173f47]/90 p-5">
            <h2 className="font-display text-lg font-semibold">Recent activities</h2>
            <ul className="mt-3 space-y-3">
              {(history.data?.items || []).slice(0, 6).map((h) => (
                <li key={h._id} className="flex gap-3 text-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/90 text-lg" aria-hidden>🌿</span>
                  <div><p>{shortDate(h.date)}: {h.title}</p><p className="text-slate-300">{h.points ? `+${h.points} points` : 'Logged'}</p></div>
                </li>
              ))}
              {!history.loading && !history.data?.items?.length && <li className="text-sm text-slate-300">Nothing yet — your first offline break starts here.</li>}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
