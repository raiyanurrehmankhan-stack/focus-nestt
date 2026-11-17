import { Minus, Plus, Quote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { POSITIVE_PROMPTS } from '@shared/constants.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { invalidate } from '../services/events.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { relativeDay, todayKey } from '../utils/time.js';

/** Screen 9: My Wins journal and personal goals (feature F9). */
export default function Wins() {
  const apply = useProgressStore((s) => s.apply);
  const wins = useApiData(() => api.listWins(), [], { keys: ['wins'] });
  const goals = useApiData(() => api.listGoals(), [], { keys: ['goals'] });
  const todays = wins.data?.items?.find((w) => w.date === todayKey());
  const [items, setItems] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);
  const prompt = POSITIVE_PROMPTS[new Date().getDate() % POSITIVE_PROMPTS.length];

  const save = async (e) => {
    e.preventDefault();
    const list = items.map((x) => x.trim()).filter(Boolean);
    if (!list.length) { toast.error('Write at least one win — even a tiny one counts.'); return; }
    setBusy(true);
    try {
      const res = await api.addWins({ date: todayKey(), items: list });
      apply(res.progress);
      setItems(['', '', '']);
      invalidate('wins', 'quests');
      toast.success('Wins saved. Be proud of that!');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="page grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card className="bg-gradient-to-br from-teal-50 to-sky-50 dark:from-teal-900/30 dark:to-slate-800">
          <Quote className="h-7 w-7 text-teal" aria-hidden />
          <p className="mt-2 font-display text-2xl font-semibold leading-snug">{prompt}</p>
          <p className="muted mt-1 text-sm">Prompt of the day</p>
        </Card>
        <Card>
          <CardHeader title="Three things I did today" subtitle={todays ? 'Saving again replaces today’s entry.' : 'Big or small, they all count.'} />
          <form onSubmit={save} className="space-y-3">
            {items.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">{i + 1}</span>
                <label htmlFor={`win-${i}`} className="sr-only">Win {i + 1}</label>
                <input id={`win-${i}`} className="field" maxLength={140} value={v} placeholder={['Finished my notes', 'Went for a walk', 'Slept on time'][i]}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
            <Button type="submit" loading={busy}>Save today's wins</Button>
          </form>
        </Card>
        <GoalsCard goals={goals} />
      </div>

      <Card>
        <CardHeader title="Past wins" />
        {wins.loading && !wins.data ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          : !wins.data?.items?.length ? <EmptyState mascot="loosening" title="Your wins will live here" message="Write your first one today. Tomorrow-you will smile reading it." />
            : (
              <ul className="space-y-3">
                {wins.data.items.map((w) => (
                  <li key={w._id} className="rounded-2xl bg-canvas-light p-4 dark:bg-slate-800/60">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{relativeDay(w.date)}</p>
                      <button type="button" className="rounded-full p-1.5 text-ink-mute hover:bg-white hover:text-danger dark:hover:bg-slate-700" aria-label={`Delete wins from ${relativeDay(w.date)}`}
                        onClick={async () => { try { await api.deleteWin(w._id); invalidate('wins'); } catch (err) { toast.error(err.message); } }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-sm">{w.items.map((x, i) => <li key={i}>✓ {x}</li>)}</ul>
                  </li>
                ))}
              </ul>
            )}
      </Card>
    </div>
  );
}

function GoalsCard({ goals }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(1);
  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try { await api.createGoal({ title: title.trim(), target: Number(target) || 1 }); setTitle(''); setTarget(1); invalidate('goals', 'dashboard'); }
    catch (err) { toast.error(err.message); }
  };
  const update = async (g, patch) => {
    try { await api.updateGoal(g._id, patch); invalidate('goals', 'dashboard'); } catch (err) { toast.error(err.message); }
  };
  const remove = async (g) => {
    try { await api.deleteGoal(g._id); invalidate('goals', 'dashboard'); } catch (err) { toast.error(err.message); }
  };
  const list = goals.data?.items || [];
  return (
    <Card>
      <CardHeader title="Personal goals" subtitle="Goals against yesterday-you, not anyone else." />
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <label htmlFor="goal-title" className="sr-only">Goal</label>
        <input id="goal-title" className="field min-w-0 flex-1" placeholder="e.g. Read 10 pages" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="goal-target" className="sr-only">Times</label>
        <input id="goal-target" type="number" min="1" max="100" className="field w-20" value={target} onChange={(e) => setTarget(e.target.value)} title="How many times" />
        <Button type="submit" variant="soft"><Plus className="h-4 w-4" /> Add</Button>
      </form>
      <ul className="mt-4 space-y-2">
        {list.length === 0 && <li className="muted text-sm">No goals yet.</li>}
        {list.map((g) => (
          <li key={g._id} className={cn('list-row', g.done && 'opacity-70')}>
            <label className="flex flex-1 items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-teal" checked={g.done} onChange={() => update(g, { progress: g.done ? 0 : g.target })} />
              <span className={cn(g.done && 'line-through')}>{g.title}</span>
            </label>
            {g.target > 1 && (
              <span className="flex items-center gap-1 text-sm">
                <button type="button" aria-label={`Decrease progress for ${g.title}`} className="rounded-full p-1 hover:bg-white dark:hover:bg-slate-700" onClick={() => update(g, { progress: Math.max(0, g.progress - 1) })}><Minus className="h-3.5 w-3.5" /></button>
                {g.progress}/{g.target}
                <button type="button" aria-label={`Increase progress for ${g.title}`} className="rounded-full p-1 hover:bg-white dark:hover:bg-slate-700" onClick={() => update(g, { progress: Math.min(g.target, g.progress + 1) })}><Plus className="h-3.5 w-3.5" /></button>
              </span>
            )}
            <button type="button" aria-label={`Delete ${g.title}`} className="rounded-full p-1.5 text-ink-mute hover:text-danger" onClick={() => remove(g)}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
