import { TriangleAlert, CircleCheck, ChevronRight, ClipboardCheck, Coffee, Info, Moon, Play, Sparkles, Target } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { WeeklyChart } from '../components/charts/WeeklyChart.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { ErrorState } from '../components/ui/ErrorState.jsx';
import { Mascot } from '../components/ui/Mascot.jsx';
import { ProgressRing } from '../components/ui/ProgressRing.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useTheme } from '../hooks/useTheme.js';
import { api } from '../services/api.js';
import { invalidate } from '../services/events.js';
import { startBreak, startFocus } from '../services/timerActions.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';
import { formatCountdown, formatHours, todayKey } from '../utils/time.js';

/** Screen 2: Dashboard (feature F2). */
export default function Dashboard() {
  const navigate = useNavigate();
  const dark = useTheme() === 'dark';
  const active = useTimerStore((s) => s.active);
  const busy = useTimerStore((s) => s.busy);
  const applyProgress = useProgressStore((s) => s.apply);
  const { data, loading, error, reload } = useApiData(async () => {
    const d = await api.getDashboard(todayKey());
    applyProgress({ points: d.points, level: d.level, streakDays: d.streakDays, sleepStreak: d.sleepStreak });
    return d;
  }, [], { keys: ['dashboard', 'checkin', 'sleep', 'goals', 'focus', 'progress'] });

  if (loading && !data) {
    return <div className="page grid gap-5 lg:grid-cols-3"><CardSkeleton lines={6} /><CardSkeleton lines={6} /><CardSkeleton lines={4} /></div>;
  }
  if (error && !data) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;

  const screenHours = data.screenTime.hours;
  const goalHours = data.screenTime.goalHours || 4;
  const ratio = screenHours == null ? 0 : screenHours / goalHours;
  const hasWeek = data.weekScreen.some((d) => d.hours != null);

  const goStart = async (kind) => {
    const t = kind === 'focus' ? await startFocus() : await startBreak();
    if (t) navigate('/focus');
  };

  return (
    <div className="page space-y-5">
      {active && <ActiveTimerBanner timer={active} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_0.95fr]">
        {/* Screen time */}
        <Card className="flex flex-col">
          <CardHeader title="Screen Time" subtitle={screenHours == null ? 'Not checked in yet today' : 'Today, from your check-in'} />
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <ProgressRing value={Math.min(1, ratio)} inner={screenHours == null ? 0 : Math.min(1, ratio * 0.85)} size={210} stroke={16}
              color={ratio > 1 ? '#EF6B6B' : '#2A9D8F'} innerColor="#1E293B" label={`Screen time ${formatHours(screenHours)} of ${goalHours} hour limit`}>
              <div>
                <div className="font-display text-3xl font-bold">{screenHours == null ? '—' : formatHours(screenHours)}</div>
                <div className="muted text-sm">of {formatHours(goalHours)} daily limit</div>
              </div>
            </ProgressRing>
            {screenHours == null
              ? <Link to="/check-in" className="inline-flex items-center gap-1 text-sm font-semibold text-teal">Add today's check-in <ChevronRight className="h-4 w-4" /></Link>
              : ratio > 1 && <p className="text-center text-sm text-danger">Over your goal today — an offline activity could help.</p>}
          </div>
        </Card>

        {/* Weekly activity */}
        <Card>
          <CardHeader title="Weekly Activity" subtitle="Screen time from your daily check-ins" />
          {hasWeek ? <WeeklyChart data={data.weekScreen} goal={goalHours} dark={dark} />
            : <EmptyState mascot="tangled" size={80} title="No week yet" message="Check in daily and your week will appear here." action={<Button size="sm" variant="soft" onClick={() => navigate('/check-in')}>Check in now</Button>} />}
        </Card>

        {/* Insight + actions */}
        <div className="flex flex-col gap-5">
          <InsightCard insight={data.insight} />
          <Button size="xl" className="w-full justify-between" onClick={() => goStart('focus')} disabled={busy}>
            Start focus session <Play className="h-6 w-6 fill-white" />
          </Button>
          <Button size="xl" variant="secondary" className="w-full" onClick={() => goStart('break')} disabled={busy}>
            Take a break
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.95fr]">
        <StatCard icon={Moon} iconClass="text-sky fill-sky/20" label="Sleep" value={data.sleep?.hours != null ? formatHours(data.sleep.hours) : '—'}
          note={data.sleep ? (data.sleep.onTarget ? 'On target 🎯' : 'Logged') : 'Log last night in Sleep'} to="/sleep" />
        <StatCard icon={Target} iconClass="text-teal" label="Focus Minutes" value={`${data.focus.minutes} mins`}
          note={`${data.focus.sessions.length} session${data.focus.sessions.length === 1 ? '' : 's'} today`} to="/focus" />
        <GoalsCard goals={data.goals} onChanged={() => invalidate('dashboard', 'goals')} />
      </div>
    </div>
  );
}

function InsightCard({ insight }) {
  const tone = insight.level === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' : insight.level === 'success' ? 'bg-teal-50 dark:bg-teal-900/30' : 'bg-sky-50 dark:bg-sky-900/20';
  const Icon = insight.level === 'warning' ? TriangleAlert : insight.level === 'success' ? CircleCheck : Info;
  return (
    <Card className={cn('relative text-center', tone)}>
      <div className="flex items-start justify-between">
        <h2 className="card-title">{insight.title || 'Insight'}</h2>
        <Icon className={cn('h-5 w-5', insight.level === 'warning' ? 'text-warning' : insight.level === 'success' ? 'text-success' : 'text-sky')} aria-hidden />
      </div>
      <Mascot state={insight.level === 'warning' ? 'tangled' : insight.level === 'success' ? 'free' : 'loosening'} size={84} className="mx-auto my-2" />
      <p className="text-lg leading-snug text-ink dark:text-slate-100">{insight.message}</p>
    </Card>
  );
}

function StatCard({ icon: Icon, iconClass, label, value, note, to }) {
  return (
    <Link to={to} className="card group block transition hover:-translate-y-0.5">
      <p className="flex items-center gap-2 text-lg font-medium"><Icon className={cn('h-6 w-6', iconClass)} aria-hidden /> {label}</p>
      <p className="mt-2 font-display text-4xl font-bold">{value}</p>
      <p className="muted mt-1 flex items-center gap-1 text-sm">{note} <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></p>
    </Link>
  );
}

function GoalsCard({ goals, onChanged }) {
  const toggle = async (g) => {
    try {
      await api.updateGoal(g.id, { progress: g.progress >= g.target ? 0 : g.target });
      onChanged();
    } catch (err) { toast.error(err.message); }
  };
  return (
    <Card>
      <CardHeader title="Today's Goals" action={<Link to="/wins" className="text-sm font-semibold text-teal">Manage</Link>} />
      {goals.length === 0 ? (
        <div className="flex items-center gap-3 text-sm">
          <Sparkles className="h-5 w-5 text-warning" />
          <span className="muted">No goals yet. <Link to="/wins" className="font-semibold text-teal">Add one small goal</Link></span>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {goals.slice(0, 3).map((g) => (
            <li key={g.id}>
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-5 w-5 rounded accent-teal" checked={g.progress >= g.target} onChange={() => toggle(g)} />
                <span className="flex-1">{g.title}</span>
                {g.target > 1 && <span className="muted text-xs">{g.progress}/{g.target}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <Link to="/check-in" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal"><ClipboardCheck className="h-4 w-4" /> Daily check-in</Link>
    </Card>
  );
}

function ActiveTimerBanner({ timer }) {
  const { remaining } = useCountdown(timer);
  const isBreak = timer.kind === 'break';
  return (
    <Link to="/focus" className={cn('flex items-center gap-4 rounded-card px-5 py-4 text-white shadow-soft', isBreak ? 'bg-sky' : 'bg-teal')}>
      {isBreak ? <Coffee className="h-6 w-6" /> : <Target className="h-6 w-6" />}
      <div className="flex-1">
        <p className="font-semibold">{isBreak ? 'Break in progress' : timer.status === 'paused' ? 'Focus paused' : `Focusing${timer.goalText ? ` on ${timer.goalText}` : ''}`}</p>
        <p className="text-sm text-white/80">Tap to open the timer</p>
      </div>
      <span className="font-display text-2xl font-bold tabular-nums">{formatCountdown(remaining)}</span>
    </Link>
  );
}
