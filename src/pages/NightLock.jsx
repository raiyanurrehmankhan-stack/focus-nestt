import { Clapperboard, Eye, Gamepad2, Info, MessagesSquare, Moon, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NIGHT_LOCK_APPS } from '@shared/constants.js';
import { PhoneFrame } from '../components/layout/PhoneFrame.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { CardSkeleton } from '../components/ui/Skeleton.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { api } from '../services/api.js';
import { toast } from '../store/useToastStore.js';
import { formatClock } from '../utils/time.js';

const ICONS = { social: Smartphone, video: Clapperboard, games: Gamepad2, messaging: MessagesSquare };

/**
 * Screen 7: Night Lock (feature F7). A website cannot see or block other
 * apps, so this is a clearly labelled simulation; the same settings will be
 * enforced by the Android app (Phase 3).
 */
export default function NightLock() {
  const { data, loading } = useApiData(() => api.getNightLock(), [], { keys: ['nightlock'] });
  const [s, setS] = useState(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.nightLock) setS(data.nightLock); }, [data]);

  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    setBusy(true);
    try { await api.saveNightLock(patch); } catch (err) { toast.error(err.message); setS(s); } finally { setBusy(false); }
  };

  if (loading || !s) return <div className="page grid gap-5 lg:grid-cols-2"><CardSkeleton lines={4} /><CardSkeleton lines={6} /></div>;
  return (
    <div className="page space-y-5">
      <div className="flex items-start gap-3 rounded-card bg-amber-50 p-4 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100" role="note">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm"><strong>Android app feature.</strong> Full blocking arrives with the Android app. Browsers cannot see or close other apps, so on the web this is a preview of your settings — nothing is blocked.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Night Lock Settings</h2>
              <Moon className="h-10 w-10 fill-slate-200 text-slate-200" aria-hidden />
            </div>
            <Toggle className="mt-5 [&_span]:text-white" label="Night Lock on" description="Apply these settings every night" checked={s.enabled} onChange={(v) => save({ enabled: v })} />
          </Card>

          <Card>
            <CardHeader title="Bedtime" />
            <input type="time" className="field h-14 max-w-[220px] text-center text-2xl font-semibold" aria-label="Night Lock time" value={s.bedtime} onChange={(e) => setS({ ...s, bedtime: e.target.value })} onBlur={() => save({ bedtime: s.bedtime })} />
            <p className="muted mt-2 text-sm">Apps will lock automatically at {formatClock(s.bedtime)} (in the Android app).</p>
          </Card>

          <Card>
            <CardHeader title="Restricted Apps" />
            <ul className="space-y-3">
              {NIGHT_LOCK_APPS.map((app) => {
                const Icon = ICONS[app.id] || Smartphone;
                return (
                  <li key={app.id} className="flex items-center gap-4 rounded-2xl px-4 py-3 ring-1 ring-line-light dark:ring-line-dark">
                    <Icon className="h-8 w-8 text-slate-400" aria-hidden />
                    <Toggle className="flex-1" label={app.label} description={app.example} checked={s.apps.includes(app.id)} disabled={busy}
                      onChange={(on) => save({ apps: on ? [...new Set([...s.apps, app.id])] : s.apps.filter((a) => a !== app.id) })} />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <Toggle label="Emergency Override" description="Allows unlocking locked apps in case of emergency" checked={s.emergencyOverride} onChange={(v) => save({ emergencyOverride: v })} />
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="text-center">
            <CardHeader title="Preview on your phone" />
            <Button variant="secondary" className="w-full" onClick={() => setPreview(true)}><Eye className="h-4 w-4" /> Preview Night Lock</Button>
          </Card>
          <Card>
            <CardHeader title="Morning report" subtitle="Example of what the Android app will show" />
            <ul className="space-y-2 text-sm">
              <li className="list-row"><span>Night Lock started</span><strong>{formatClock(s.bedtime)}</strong></li>
              <li className="list-row"><span>Unlock attempts</span><strong>2</strong></li>
              <li className="list-row"><span>Emergency overrides</span><strong>0</strong></li>
              <li className="list-row"><span>Time saved (estimate)</span><strong className="text-teal">1h 10m</strong></li>
            </ul>
            <p className="muted mt-3 text-xs">Sample data. Real usage reports need the Android app's Usage Access permission.</p>
          </Card>
        </aside>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="Night Lock preview" className="sm:max-w-sm">
        <PhoneFrame dark width={270}>
          <div className="flex h-full flex-col items-center justify-center gap-4 px-5 text-center">
            <Moon className="h-14 w-14 fill-slate-200 text-slate-200" />
            <p className="font-display text-xl font-bold">Time to unplug</p>
            <p className="text-sm text-slate-300">It's {formatClock(s.bedtime)}. {s.apps.length ? `${NIGHT_LOCK_APPS.filter((a) => s.apps.includes(a.id)).map((a) => a.label).join(', ')} are paused.` : 'No apps selected.'}</p>
            <span className="w-full rounded-full bg-teal py-2.5 text-sm font-semibold">I'll put my phone away</span>
            {s.emergencyOverride && <span className="w-full rounded-full border border-red-400/60 py-2.5 text-sm text-slate-300">Emergency override</span>}
          </div>
        </PhoneFrame>
        <p className="muted mt-4 text-center text-xs">Simulation only. No apps were blocked.</p>
      </Modal>
    </div>
  );
}
