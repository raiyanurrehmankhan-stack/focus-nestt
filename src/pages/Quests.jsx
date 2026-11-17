import { CircleCheck, Circle, Lock } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { cn } from '../utils/cn.js';
import { todayKey } from '../utils/time.js';

/** Screen 8: Quests and badges (feature F8). Points reward focus and sleep, not time in the app. */
export default function Quests() {
  const apply = useProgressStore((s) => s.apply);
  const { data, loading, error, reload } = useApiData(async () => {
    const d = await api.getQuests(todayKey());
    apply({ points: d.points, level: d.level });
    return d;
  }, [], { keys: ['quests', 'progress'] });

  if (loading && !data) return <div className="page grid gap-5 lg:grid-cols-2"><CardSkeleton lines={2} /><CardSkeleton lines={8} /><CardSkeleton lines={6} /></div>;
  if (error && !data) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;
  const { level } = data;

  return (
    <div className="page grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="font-display text-4xl font-bold text-teal-700 dark:text-teal-300">{data.points.toLocaleString()} Points</p>
            <p className="muted text-sm">{level.toNext} XP to Level {level.level + 1}</p>
          </div>
          <div className="relative mt-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={level.perLevel} aria-valuenow={level.intoLevel} aria-label="Level progress">
            <div className="h-full rounded-full bg-gradient-to-r from-sky to-teal-700" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
            <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-200 shadow-glow" style={{ left: `${Math.max(3, level.progress * 100)}%` }} aria-hidden />
          </div>
          <p className="mt-3 font-semibold">Level {level.level} — {level.name}</p>
        </Card>

        <Card>
          <CardHeader title="Weekly Quests" subtitle="Made from your onboarding answers. Resets every Monday." />
          <ul className="space-y-5">
            {data.quests.map((q) => (
              <li key={q.code} className="flex gap-3">
                {q.completed ? <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal" /> : <Circle className="mt-0.5 h-6 w-6 shrink-0 text-slate-300" />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{q.title}</p>
                  <p className="muted text-sm">{q.description} ({q.value}/{q.target} {q.unit})</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-teal-700 dark:bg-teal-400" style={{ width: `${q.percent}%` }} /></div>
                    <span className="w-10 text-right text-sm">{q.percent}%</span>
                  </div>
                </div>
                <span className={cn('shrink-0 self-center rounded-full px-2.5 py-1 text-sm font-semibold', q.rewarded ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200' : 'text-ink-soft')}>
                  {q.rewarded ? '✓ ' : '🪙 '}+{q.reward} pts
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {data.history?.length > 0 && (
          <Card>
            <CardHeader title="Recent points" />
            <ul className="space-y-2">
              {data.history.map((h, i) => <li key={i} className="list-row text-sm"><span>{h.reason}</span><strong className="text-teal">+{h.amount}</strong></li>)}
            </ul>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title="Your Badge Shelf" action={<span className="muted text-sm">🪺 Nest and Bird Theme</span>} />
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4">
          {data.badges.map((b) => (
            <div key={b.code} className="flex flex-col items-center text-center" title={b.description}>
              <div className={cn('relative grid h-20 w-20 place-items-center rounded-full border-4 text-4xl transition sm:h-24 sm:w-24',
                b.unlocked ? 'border-teal-700 bg-gradient-to-br from-teal-50 to-sky-100 shadow-soft dark:from-teal-900 dark:to-slate-800' : 'border-slate-300 bg-slate-100 grayscale dark:border-slate-600 dark:bg-slate-800')}>
                <span className={b.unlocked ? '' : 'opacity-30'} aria-hidden>{b.emoji}</span>
                {!b.unlocked && <Lock className="absolute h-7 w-7 text-slate-500" aria-hidden />}
              </div>
              <div className="-mt-1 h-2 w-[90%] rounded-full bg-amber-800/30 dark:bg-amber-200/10" aria-hidden />
              <p className={cn('mt-2 text-sm font-semibold', !b.unlocked && 'text-ink-mute')}>{b.name}</p>
              <p className="muted text-xs">{b.unlocked ? 'Unlocked' : b.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
