import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DANGER_TIMES, STRUGGLES, USER_TYPES } from '@shared/constants.js';
import { Button } from '../components/ui/Button.jsx';
import { Logo } from '../components/ui/Logo.jsx';
import { Mascot } from '../components/ui/Mascot.jsx';
import { HAS_BACKEND } from '../config.js';
import { localApi } from '../services/api.js';
import { loadSession } from '../services/session.js';
import { writeJSON } from '../services/storage.js';
import { useAppStore } from '../store/useAppStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';

const TYPE_EMOJI = { 'School student': '🎒', 'University student': '🎓', 'Working professional': '💼', Other: '🌱' };
const TIME_EMOJI = { Morning: '🌅', Afternoon: '☀️', Evening: '🌆', 'Late night (after 12 AM)': '🌙' };
const STEPS = 6; // welcome + 5 questions, then the personalised welcome

/** Screen 1: Welcome and onboarding quiz (feature F1). */
export default function Onboarding() {
  const navigate = useNavigate();
  const setTheme = useAppStore((s) => s.setTheme);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState({ userType: '', ageGroup: '', struggles: [], dangerTime: '', screenGoalHours: 4, bedtimeGoal: '23:00', name: '' });
  const set = (patch) => setA((x) => ({ ...x, ...patch }));
  const canNext = [true, a.userType && a.ageGroup, a.struggles.length > 0, a.dangerTime, true, a.name.trim().length > 0][step];
  const study = a.userType === 'Working professional' ? 'work' : a.userType === 'Other' ? 'study or work' : 'study';

  const finish = async (withAccount) => {
    setBusy(true);
    try {
      const profile = {
        name: a.name.trim().slice(0, 40), userType: a.userType, ageGroup: a.ageGroup, struggles: a.struggles, dangerTime: a.dangerTime,
        screenGoalHours: Number(a.screenGoalHours), bedtimeGoal: a.bedtimeGoal, demoMode: true, theme: 'auto',
      };
      if (withAccount) {
        writeJSON('fn:onboarding', profile);
        navigate('/signup');
        return;
      }
      await localApi.createGuestProfile(profile);
      setTheme('auto');
      await loadSession();
      navigate('/', { replace: true });
      toast.success(`Welcome to FocusNest, ${profile.name.split(' ')[0]}!`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-canvas-light via-[#EAF3F7] to-[#E4ECF8] px-4 py-6 dark:from-canvas-dark dark:to-[#111c33] sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col">
        <header className="flex items-center justify-between">
          <Logo size={40} />
          {step > 0 && step < STEPS && <span className="muted text-sm font-medium">Question {step} of 5</span>}
        </header>
        {step > 0 && step < STEPS && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={step}>
            <div className="h-full rounded-full bg-gradient-to-r from-teal to-sky transition-all" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        )}

        <main className="flex flex-1 flex-col justify-center py-8 animate-fadeIn" key={step}>
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <Mascot state="tangled" size={180} alt="The FocusNest bird, wrapped in endless circles" />
              <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl"><span className="text-teal">Focus</span><span className="text-sky">Nest</span></h1>
              <p className="mt-2 font-display text-xl font-semibold text-ink-soft dark:text-slate-300">Track it. Control it. Replace it.</p>
              <p className="muted mt-4 max-w-md">Stop "five more minutes" from turning into hours. FocusNest gently pulls you back to what matters — on your laptop and your phone.</p>
              <Button size="lg" className="mt-8 w-full max-w-xs" onClick={() => setStep(1)}>Get started <ArrowRight className="h-5 w-5" /></Button>
              {HAS_BACKEND && <Button variant="ghost" className="mt-3" onClick={() => navigate('/signin')}>I already have an account</Button>}
            </div>
          )}

          {step === 1 && (
            <Question title="Who are you?" hint="FocusNest is for everyone. This just helps us use the right words.">
              <div className="grid gap-3 sm:grid-cols-2">
                {USER_TYPES.map((t) => <Option key={t} selected={a.userType === t} onClick={() => set({ userType: t })} emoji={TYPE_EMOJI[t]} label={t} />)}
              </div>
              <p className="label mt-6">Your age group</p>
              <div className="flex flex-wrap gap-2">
                {['Under 18', '18-24', '25-34', '35+'].map((g) => (
                  <button key={g} type="button" onClick={() => set({ ageGroup: g })} aria-pressed={a.ageGroup === g}
                    className={cn('rounded-full px-4 py-2 text-sm font-semibold ring-2 transition', a.ageGroup === g ? 'bg-teal text-white ring-teal' : 'bg-white ring-transparent hover:ring-teal/40 dark:bg-slate-800')}>{g}</button>
                ))}
              </div>
              {a.ageGroup === 'Under 18' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">You can use FocusNest on this device right away. To create an online account, a parent or guardian needs to agree.</p>}
            </Question>
          )}

          {step === 2 && (
            <Question title="What pulls you in most?" hint="Pick everything that sounds like you.">
              <div className="grid gap-3 sm:grid-cols-2">
                {STRUGGLES.map((s) => (
                  <Option key={s.id} emoji={s.emoji} label={s.label} selected={a.struggles.includes(s.id)}
                    onClick={() => set({ struggles: a.struggles.includes(s.id) ? a.struggles.filter((x) => x !== s.id) : [...a.struggles, s.id] })} multi />
                ))}
              </div>
            </Question>
          )}

          {step === 3 && (
            <Question title="When is it hardest to put the phone down?" hint="We will call this your danger time.">
              <div className="grid gap-3 sm:grid-cols-2">
                {DANGER_TIMES.map((t) => <Option key={t} emoji={TIME_EMOJI[t]} label={t} selected={a.dangerTime === t} onClick={() => set({ dangerTime: t })} />)}
              </div>
            </Question>
          )}

          {step === 4 && (
            <Question title="Set two gentle goals" hint={`You can change these any time. Small and realistic beats perfect.`}>
              <div className="card space-y-6">
                <div>
                  <label htmlFor="ob-goal" className="label">Daily screen-time goal: <strong className="text-teal">{a.screenGoalHours} hours</strong></label>
                  <input id="ob-goal" type="range" min="1" max="10" step="0.5" value={a.screenGoalHours} onChange={(e) => set({ screenGoalHours: Number(e.target.value) })} className="w-full accent-teal" />
                  <div className="muted flex justify-between text-xs"><span>1h</span><span>10h</span></div>
                </div>
                <div>
                  <label htmlFor="ob-bed" className="label">Bedtime goal</label>
                  <input id="ob-bed" type="time" className="field max-w-[180px]" value={a.bedtimeGoal} onChange={(e) => set({ bedtimeGoal: e.target.value || '23:00' })} />
                </div>
              </div>
            </Question>
          )}

          {step === 5 && (
            <Question title="What should we call you?" hint="Just a first name or nickname is perfect.">
              <input autoFocus className="field h-14 text-lg" maxLength={40} placeholder="Your name" value={a.name} onChange={(e) => set({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && a.name.trim()) setStep(6); }} aria-label="Your name" />
            </Question>
          )}

          {step === 6 && (
            <div className="flex flex-col items-center text-center">
              <Mascot state="free" size={170} alt="The FocusNest bird flying free" />
              <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">Welcome, {a.name.split(' ')[0]}! 🎉</h1>
              <p className="muted mt-3 max-w-md">
                Your nest is ready. We'll help you keep {study} breaks short{a.struggles.includes('latenight') || a.dangerTime?.startsWith('Late') ? ', wind down before bedtime' : ''}
                {a.struggles.includes('lonely') ? ' and find real-world connection' : ''}{a.struggles.includes('comparison') ? ', and celebrate your own wins' : ''}.
              </p>
              <ul className="mt-5 space-y-2 text-left text-sm">
                {['Break timer with a gentle alarm', `${a.screenGoalHours}-hour daily screen goal`, `Bedtime goal at ${a.bedtimeGoal}`, 'Quests made for you'].map((x) => (
                  <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {x}</li>
                ))}
              </ul>
              <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
                <Button size="lg" loading={busy} onClick={() => finish(false)}>Start using FocusNest <ArrowRight className="h-5 w-5" /></Button>
                {HAS_BACKEND && (
                  <Button size="lg" variant="outline" onClick={() => finish(true)}>Create an account to sync my phone</Button>
                )}
                <p className="muted text-xs">{HAS_BACKEND ? 'Without an account, everything stays private on this device.' : 'Everything stays private on this device.'}</p>
              </div>
            </div>
          )}
        </main>

        {step > 0 && step < STEPS && (
          <footer className="flex items-center justify-between gap-3 pb-[var(--safe-bottom)]">
            <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 5 ? 'Finish' : 'Next'} <ArrowRight className="h-5 w-5" /></Button>
          </footer>
        )}
      </div>
    </div>
  );
}

function Question({ title, hint, children }) {
  return (
    <section aria-labelledby="q-title">
      <h1 id="q-title" className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      {hint && <p className="muted mt-2">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Option({ emoji, label, selected, onClick, multi }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cn('flex min-h-[84px] items-center gap-4 rounded-2xl bg-white p-5 text-left font-display text-lg font-semibold shadow-soft ring-2 transition hover:-translate-y-0.5 dark:bg-card-dark',
        selected ? 'ring-teal' : 'ring-transparent hover:ring-teal/30')}>
      <span className="text-3xl" aria-hidden>{emoji}</span>
      <span className="flex-1">{label}</span>
      <span className={cn('grid h-6 w-6 place-items-center border-2', multi ? 'rounded-md' : 'rounded-full', selected ? 'border-teal bg-teal text-white' : 'border-slate-300 dark:border-slate-600')} aria-hidden>
        {selected && <Check className="h-4 w-4" />}
      </span>
    </button>
  );
}
