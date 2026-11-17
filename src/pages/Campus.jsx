import { CalendarDays, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { toast } from '../store/useToastStore.js';

/** Screen 11: Community hub (feature F12) — static events in Phase 1. */
export default function Campus() {
  const { data, loading, setData } = useApiData(() => api.getCampus(), [], { keys: ['campus'] });
  const [busy, setBusy] = useState(null);

  const join = async (kind, item) => {
    setBusy(item.id);
    try {
      await api.joinEvent(item.id, !item.joined);
      setData((d) => ({ ...d, [kind]: d[kind].map((x) => (x.id === item.id ? { ...x, joined: !x.joined } : x)) }));
      toast.success(item.joined ? 'Removed from your plans' : 'Added to your plans 🎉');
    } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  if (loading && !data) return <div className="page grid gap-5 lg:grid-cols-2"><CardSkeleton lines={6} /><CardSkeleton lines={6} /></div>;
  return (
    <div className="page space-y-5">
      <p className="muted text-sm">Example events and clubs. Your campus or workplace can add real ones later — nothing you join is shared with anyone.</p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Upcoming events" icon={CalendarDays} />
          <ul className="space-y-3">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-canvas-light p-4 dark:bg-slate-800/60">
                <span className="text-3xl" aria-hidden>{e.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title} <span className="chip ml-1 px-2 py-0.5 text-xs">{e.type}</span></p>
                  <p className="muted mt-0.5 flex flex-wrap gap-x-3 text-sm"><span>{e.when}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.place}</span></p>
                </div>
                <Button size="sm" variant={e.joined ? 'soft' : 'primary'} loading={busy === e.id} onClick={() => join('events', e)}>{e.joined ? '✓ Going' : 'Join'}</Button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Group challenges" icon={Users} />
            <ul className="space-y-3">
              {data.challenges.map((c) => (
                <li key={c.id} className="rounded-2xl p-4 ring-1 ring-line-light dark:ring-line-dark">
                  <p className="font-semibold">{c.title}</p>
                  <p className="muted text-sm">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="muted text-xs">{c.participants + (c.joined ? 1 : 0)} taking part</span>
                    <Button size="sm" variant={c.joined ? 'soft' : 'outline'} loading={busy === c.id} onClick={() => join('challenges', c)}>{c.joined ? '✓ Joined' : 'Join challenge'}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Clubs" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.clubs.map((c) => (
                <li key={c.id} className="rounded-2xl bg-canvas-light p-4 dark:bg-slate-800/60">
                  <p className="font-semibold">{c.name}</p>
                  <p className="muted text-sm">{c.description}</p>
                  <button type="button" className="mt-2 text-sm font-semibold text-teal" onClick={() => join('clubs', c)} disabled={busy === c.id}>{c.joined ? '✓ Interested' : "I'm interested"}</button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
