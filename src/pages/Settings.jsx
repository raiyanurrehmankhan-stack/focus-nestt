import { Bell, Download, LogOut, Monitor, RefreshCw, Shield, Smartphone, Sun, Trash2, UserRound, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { APP_VERSION, HAS_BACKEND } from '../config.js';
import { useApiData } from '../hooks/useApiData.js';
import { api, isAccountMode, localApi, remoteApi } from '../services/api.js';
import { getDeviceId } from '../services/device.js';
import { invalidate } from '../services/events.js';
import { notificationPermission, requestNotificationPermission } from '../services/notifications.js';
import { applyUpdate, promptInstall } from '../services/pwa.js';
import { currentSubscription, disablePush, enablePush, pushNeedsInstall, pushSupported } from '../services/push.js';
import { loadSession, signOut } from '../services/session.js';
import { playAlarm } from '../services/sound.js';
import { useAppStore } from '../store/useAppStore.js';
import { toast } from '../store/useToastStore.js';
import { cn } from '../utils/cn.js';

/** Screen 14: Settings (theme, notifications, defaults, buddy, devices, data). */
export default function Settings() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const mode = useAppStore((s) => s.mode);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const patchUser = useAppStore((s) => s.patchUser);
  const install = useAppStore((s) => s.install);
  const update = useAppStore((s) => s.update);
  const [form, setForm] = useState({ name: user.name, defaultBreakMinutes: user.defaultBreakMinutes, screenGoalHours: user.screenGoalHours, buddyEmail: user.buddyEmail || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const savePatch = async (patch, msg) => {
    try {
      const { user: u } = await api.updateProfile(patch);
      patchUser(u || patch);
      if (msg) toast.success(msg);
      invalidate('dashboard');
      return true;
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
      return false;
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    await savePatch({ name: form.name.trim(), defaultBreakMinutes: Number(form.defaultBreakMinutes), screenGoalHours: Number(form.screenGoalHours), buddyEmail: form.buddyEmail.trim() }, 'Settings saved');
    setSaving(false);
  };

  const chooseTheme = (t) => { setTheme(t); savePatch({ theme: t }); };

  return (
    <div className="page grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Appearance" icon={Sun} />
          <Segmented ariaLabel="Theme" value={theme} onChange={chooseTheme} options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
          <p className="muted mt-2 text-sm">Auto uses dark mode from 7 PM to 6 AM.</p>
          <Toggle className="mt-4" label="Reduce motion" description="Turn off breathing and pulse animations" checked={document.documentElement.classList.contains('reduce-motion')}
            onChange={(on) => { document.documentElement.classList.toggle('reduce-motion', on); try { localStorage.setItem('fn:reduce-motion', on ? '1' : '0'); } catch { /* ignore */ } }} />
        </Card>

        <Card>
          <CardHeader title="Profile and defaults" icon={UserRound} />
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="s-name" className="label">Name</label>
              <input id="s-name" className="field" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="s-break" className="label">Default break (minutes)</label>
                <input id="s-break" type="number" min="1" max="120" className="field" value={form.defaultBreakMinutes} onChange={(e) => setForm({ ...form, defaultBreakMinutes: e.target.value })} />
                {errors.defaultBreakMinutes && <p className="field-error">{errors.defaultBreakMinutes}</p>}
              </div>
              <div>
                <label htmlFor="s-goal" className="label">Daily screen goal (hours)</label>
                <input id="s-goal" type="number" min="0.5" max="16" step="0.5" className="field" value={form.screenGoalHours} onChange={(e) => setForm({ ...form, screenGoalHours: e.target.value })} />
                {errors.screenGoalHours && <p className="field-error">{errors.screenGoalHours}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="s-buddy" className="label">Accountability buddy's email (optional)</label>
              <input id="s-buddy" type="email" className="field" placeholder="friend@example.com" value={form.buddyEmail} onChange={(e) => setForm({ ...form, buddyEmail: e.target.value })} />
              <p className="muted mt-1 text-xs">{mode === 'account' ? 'They get an email only when you extend a break — never the reason.' : 'Buddy emails need an account.'}</p>
              {errors.buddyEmail && <p className="field-error">{errors.buddyEmail}</p>}
            </div>
            <Toggle label="Demo mode" description="Timers last 30 seconds — great for presentations" checked={user.demoMode} onChange={(v) => savePatch({ demoMode: v })} />
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>

        <NotificationsCard user={user} savePatch={savePatch} />
      </div>

      <div className="space-y-5">
        <AccountCard mode={mode} user={user} onDelete={() => setConfirm(true)} navigate={navigate} />
        <DevicesCard mode={mode} />

        <Card>
          <CardHeader title="App" icon={Download} />
          <div className="space-y-3">
            {install.installed ? <p className="chip">✓ Installed on this device</p>
              : install.canPrompt ? <Button onClick={promptInstall}><Download className="h-4 w-4" /> Install FocusNest</Button>
                : <Link to="/install" className="font-semibold text-teal">How to install FocusNest on this device →</Link>}
            <div className="flex items-center justify-between">
              <span className="muted text-sm">Version {APP_VERSION}</span>
              {update.available
                ? <Button size="sm" onClick={applyUpdate}><RefreshCw className="h-4 w-4" /> Update now</Button>
                : <Button size="sm" variant="ghost" onClick={async () => { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); toast.info(useAppStore.getState().update.available ? 'An update is ready.' : 'You have the latest version.'); }}>Check for updates</Button>}
            </div>
          </div>
        </Card>

        <DataCard mode={mode} onDelete={() => setConfirm(true)} />
      </div>

      <DeleteModal open={confirm} onClose={() => setConfirm(false)} mode={mode} />
    </div>
  );
}

function NotificationsCard({ user, savePatch }) {
  const mode = useAppStore((s) => s.mode);
  const caps = useAppStore((s) => s.capabilities);
  const [perm, setPerm] = useState(notificationPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { currentSubscription().then((s) => setSubscribed(Boolean(s))).catch(() => {}); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      if (mode === 'account' && caps.push) { await enablePush(); setSubscribed(true); toast.success('Notifications are on for this device.'); }
      else {
        const p = await requestNotificationPermission();
        if (p !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or system settings.');
        toast.success('Notifications are on while FocusNest is open.');
      }
    } catch (err) { toast.error(err.message); } finally { setPerm(notificationPermission()); setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try { await disablePush(); setSubscribed(false); toast.info('Push notifications are off for this device.'); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader title="Notifications and sound" icon={Bell} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Break and focus reminders</p>
            <p className="muted text-sm">
              {perm === 'unsupported' ? 'Not supported in this browser.' : perm === 'denied' ? 'Blocked — allow notifications in your browser settings.' : subscribed ? 'On, including when the app is closed.' : perm === 'granted' ? 'On while FocusNest is open.' : 'Off'}
            </p>
            {pushNeedsInstall() && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">iPhone/iPad: add FocusNest to your Home Screen to get notifications.</p>}
            {mode === 'guest' && <p className="muted mt-1 text-xs">Create an account to get notifications on your phone when the app is closed.</p>}
          </div>
          {subscribed ? <Button size="sm" variant="ghost" loading={busy} onClick={disable}>Turn off</Button>
            : <Button size="sm" loading={busy} disabled={perm === 'denied' || perm === 'unsupported'} onClick={enable}>Turn on</Button>}
        </div>
        {subscribed && <Button size="sm" variant="soft" onClick={() => api.testPush().then(() => toast.success('Test notification sent')).catch((e) => toast.error(e.message))}>Send a test notification</Button>}
        <div className="flex items-center gap-3 border-t border-line-light pt-4 dark:border-line-dark">
          <Volume2 className="h-5 w-5 text-teal" />
          <Toggle className="flex-1" label="Alarm sound" description="A gentle chime when a break ends" checked={user.soundOn !== false} onChange={(v) => savePatch({ soundOn: v })} />
          <Button size="sm" variant="ghost" onClick={() => playAlarm({ repeat: 1 })}>Test</Button>
        </div>
        {!pushSupported() && <p className="muted text-xs">This browser can't receive push notifications.</p>}
      </div>
    </Card>
  );
}

function AccountCard({ mode, user, navigate }) {
  if (!HAS_BACKEND) {
    return (
      <Card>
        <CardHeader title="Account" icon={Shield} />
        <p className="muted text-sm">This copy of FocusNest runs without a server. Everything is stored privately on this device and works offline.</p>
      </Card>
    );
  }
  if (mode === 'guest') {
    return (
      <Card>
        <CardHeader title="Sync your laptop and phone" icon={Smartphone} />
        <p className="muted text-sm">Create a free account to share the break timer across devices and get notifications on your phone. Your current progress can come with you.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => navigate('/signup')}>Create account</Button>
          <Button variant="ghost" onClick={() => navigate('/signin')}>Sign in</Button>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Account" icon={Shield} />
      <p className="font-medium">{user.name}</p>
      <p className="muted text-sm">{user.email}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="soft" onClick={() => signOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
        <Button variant="ghost" onClick={() => signOut({ everywhere: true })}>Sign out of all devices</Button>
      </div>
    </Card>
  );
}

function DevicesCard({ mode }) {
  const { data, reload } = useApiData(() => api.listDevices(), [mode], { keys: ['devices'] });
  const me = getDeviceId();
  const Icon = (t) => (t === 'phone' ? Smartphone : Monitor);
  return (
    <Card>
      <CardHeader title="Connected devices" icon={Smartphone} subtitle={mode === 'account' ? 'Devices signed in to your account' : 'Guest mode: this device only'} />
      <ul className="space-y-2">
        {(data?.items || []).map((d) => {
          const I = Icon(d.type);
          return (
            <li key={d.deviceId} className="list-row">
              <I className="h-5 w-5 text-teal" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.label}{d.deviceId === me && <span className="muted"> (this device)</span>}</p>
                <p className="muted text-xs">{d.online ? 'Online now' : `Last seen ${new Date(d.lastSeenAt).toLocaleString()}`}{d.push ? ' · notifications on' : ''}</p>
              </div>
              <span className={cn('h-2.5 w-2.5 rounded-full', d.online ? 'bg-success' : 'bg-slate-300')} aria-label={d.online ? 'online' : 'offline'} />
              {mode === 'account' && d.deviceId !== me && (
                <button type="button" className="rounded-full p-1.5 text-ink-mute hover:text-danger" aria-label={`Remove ${d.label}`} onClick={async () => { await api.removeDevice(d.deviceId).catch((e) => toast.error(e.message)); reload(); }}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          );
        })}
      </ul>
      {mode === 'account' && <p className="muted mt-3 text-xs">To add your phone: open this site on it, sign in, and add it to your Home Screen.</p>}
    </Card>
  );
}

function DataCard({ mode, onDelete }) {
  const [busy, setBusy] = useState(false);
  const exportJson = async () => {
    setBusy(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `focusnest-${mode}-export.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader title="Your data, your choice" icon={Shield} />
      <p className="muted text-sm">{mode === 'account'
        ? 'We store only what you enter: check-ins, sessions, sleep, wins and goals. Mood and journal entries are private. No access to your phone’s apps or messages.'
        : 'Guest mode keeps everything in this browser. Nothing is sent anywhere.'}</p>
      <div className="mt-4 space-y-2">
        <div className="list-row"><span>Download a copy (JSON)</span><Button size="sm" variant="soft" loading={busy} onClick={exportJson}>Export</Button></div>
        {mode === 'guest' && <div className="list-row"><span>Fill with 7 days of sample data (for demos)</span><Button size="sm" variant="soft" onClick={async () => { await localApi.loadSampleData(); await loadSession(); invalidate('*'); toast.success('Sample data loaded'); }}>Load</Button></div>}
        <div className="list-row"><span>{mode === 'account' ? 'Delete my account and all data' : 'Delete all data on this device'}</span><Button size="sm" variant="danger-outline" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</Button></div>
      </div>
    </Card>
  );
}

function DeleteModal({ open, onClose, mode }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if (isAccountMode()) {
        await remoteApi.deleteAccount(password);
        await signOut({ silent: true });
        toast.success('Your account and all its data were deleted.');
      } else {
        await localApi.deleteAllData();
        await loadSession();
        toast.success('All data on this device was deleted.');
        navigate('/welcome');
      }
      onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={mode === 'account' ? 'Delete your account?' : 'Delete all data?'}>
      <p className="muted">{mode === 'account' ? 'This permanently deletes your account, check-ins, sessions, sleep logs, wins, goals and badges from our servers. This cannot be undone.' : 'This permanently removes your check-ins, sleep logs, wins, goals and points from this browser. This cannot be undone.'}</p>
      {mode === 'account' && (
        <div className="mt-4">
          <label htmlFor="del-pw" className="label">Enter your password to confirm</label>
          <input id="del-pw" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={busy} disabled={mode === 'account' && !password} onClick={run}>Delete everything</Button>
      </div>
    </Modal>
  );
}

