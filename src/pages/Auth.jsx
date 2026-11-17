import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Logo } from '../components/ui/Logo.jsx';
import { HAS_BACKEND } from '../config.js';
import { localApi } from '../services/api.js';
import { signIn, signUp } from '../services/session.js';
import { readJSON, removeKey } from '../services/storage.js';
import { useAppStore } from '../store/useAppStore.js';
import { toast } from '../store/useToastStore.js';

/** Sign in / create account (Phase 2: real accounts and device sync). */
export default function Auth({ mode = 'signin' }) {
  const navigate = useNavigate();
  const current = useAppStore((s) => s.user);
  const quiz = readJSON('fn:onboarding') || (current?.guest ? current : null) || {};
  const [form, setForm] = useState({ name: quiz.name || '', email: '', password: '', parentalConsent: false });
  const [importGuest, setImportGuest] = useState(localApi.hasGuestData());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const minor = quiz.ageGroup === 'Under 18';

  if (!HAS_BACKEND) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold">Accounts are not available yet</h1>
        <p className="muted mt-2">This copy of FocusNest is not connected to a server, so everything is saved privately on this device. All features still work.</p>
        <Button className="mt-6 w-full" onClick={() => navigate('/')}>Continue</Button>
      </Shell>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (signup) {
        const { name, email, password, parentalConsent } = form;
        const profile = {
          name, email, password,
          ...(quiz.userType ? { userType: quiz.userType } : {}),
          ...(quiz.ageGroup ? { ageGroup: quiz.ageGroup } : {}),
          ...(minor ? { parentalConsent } : {}),
          struggles: quiz.struggles || [],
          ...(quiz.dangerTime ? { dangerTime: quiz.dangerTime } : {}),
          ...(quiz.screenGoalHours ? { screenGoalHours: Number(quiz.screenGoalHours) } : {}),
          ...(quiz.bedtimeGoal ? { bedtimeGoal: quiz.bedtimeGoal } : {}),
          ...(quiz.defaultBreakMinutes ? { defaultBreakMinutes: quiz.defaultBreakMinutes } : {}),
          demoMode: false, // new accounts use real timer lengths; demo mode stays optional in Settings
        };
        const user = await signUp(profile, { importGuest });
        removeKey('fn:onboarding');
        toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}!`);
      } else {
        const user = await signIn({ email: form.email, password: form.password });
        toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(err.fields || { _: err.message });
      if (!err.fields) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const field = (key, props) => (
    <div>
      <label htmlFor={`auth-${key}`} className="label">{props.label}</label>
      <input id={`auth-${key}`} className="field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `auth-${key}-err` : undefined} {...props} label={undefined} />
      {errors[key] && <p id={`auth-${key}-err`} className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <Shell>
      <h1 className="font-display text-2xl font-bold">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="muted mt-1 text-sm">{signup ? 'Sync your break timer between laptop and phone, and get notifications.' : 'Sign in to sync your devices.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {signup && field('name', { label: 'Name', autoComplete: 'given-name', maxLength: 40, required: true })}
        {field('email', { label: 'Email', type: 'email', autoComplete: 'email', inputMode: 'email', required: true })}
        {field('password', { label: 'Password', type: 'password', autoComplete: signup ? 'new-password' : 'current-password', minLength: signup ? 8 : 1, required: true })}
        {signup && <p className="muted -mt-2 text-xs">At least 8 characters, with a letter and a number.</p>}
        {signup && minor && (
          <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/30">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={form.parentalConsent} onChange={(e) => setForm({ ...form, parentalConsent: e.target.checked })} />
            <span>My parent or guardian has agreed that I can create a FocusNest account.</span>
          </label>
        )}
        {errors.parentalConsent && <p className="field-error">{errors.parentalConsent}</p>}
        {signup && localApi.hasGuestData() && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={importGuest} onChange={(e) => setImportGuest(e.target.checked)} />
            <span>Bring my check-ins, sleep logs, wins and points from this device into my account</span>
          </label>
        )}
        {errors._ && <p className="field-error" role="alert">{errors._}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{signup ? 'Create account' : 'Sign in'}</Button>
      </form>
      <p className="muted mt-5 text-center text-sm">
        {signup ? <>Already have an account? <Link className="font-semibold text-teal" to="/signin">Sign in</Link></> : <>New here? <Link className="font-semibold text-teal" to={current ? '/signup' : '/welcome'}>Create an account</Link></>}
      </p>
      <p className="muted mt-4 text-center text-xs">We store only what you enter (check-ins, sleep, goals). Passwords are hashed. You can export or delete everything in Settings.</p>
    </Shell>
  );
}

function Shell({ children }) {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-canvas-light to-[#E4ECF8] px-4 py-8 dark:from-canvas-dark dark:to-[#111c33]">
      <div className="w-full max-w-md">
        <button type="button" onClick={() => navigate(-1)} className="muted mb-4 inline-flex items-center gap-1 text-sm font-medium hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="card">
          <Logo size={44} className="mb-5" />
          {children}
        </div>
      </div>
    </div>
  );
}
