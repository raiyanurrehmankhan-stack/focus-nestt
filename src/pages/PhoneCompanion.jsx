import { CircleCheck, Copy, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneSimulator } from '../components/focus/PhoneSimulator.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { HAS_BACKEND } from '../config.js';
import { useAppStore } from '../store/useAppStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { toast } from '../store/useToastStore.js';

/**
 * Screen 13: Phone companion. On a real phone, FocusNest itself is the
 * companion (bottom navigation, same timer). On a laptop this page shows the
 * phone view inside a frame for the demo, and how to connect a real phone.
 */
export default function PhoneCompanion() {
  const active = useTimerStore((s) => s.active);
  const mode = useAppStore((s) => s.mode);
  const sync = useAppStore((s) => s.sync);
  const [preview, setPreview] = useState('live');
  const fake = {
    feed: { id: 'demo-feed', kind: 'break', status: 'running', startAt: new Date(Date.now() - 60000).toISOString(), endAt: new Date(Date.now() + 29 * 60000).toISOString(), plannedMinutes: 30, extensions: [] },
    locked: { id: 'demo-locked', kind: 'break', status: 'ended', startAt: new Date().toISOString(), endAt: new Date().toISOString(), plannedMinutes: 30, extensions: [] },
    focus: { id: 'demo-focus', kind: 'focus', status: 'running', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 25 * 60000).toISOString(), plannedMinutes: 25 },
  };
  const timer = preview === 'live' ? active : fake[preview];
  const url = typeof location !== 'undefined' ? location.origin : '';
  return (
    <div className="page grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col items-center gap-4">
        <Segmented ariaLabel="Phone screen" value={preview} onChange={setPreview} options={[{ value: 'live', label: 'Live' }, { value: 'feed', label: 'Break' }, { value: 'locked', label: 'Break over' }, { value: 'focus', label: 'Focus' }]} />
        <PhoneSimulator timer={timer} width={300} />
        {preview === 'live' && <p className="muted text-center text-sm">Showing your real timer. Start a break on the Focus page and watch this screen change.</p>}
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Use FocusNest on your real phone" icon={Smartphone} />
          <ol className="space-y-3">
            <Step n={1}>Open <strong className="break-all">{url}</strong> on your phone.
              <button type="button" className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-teal" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.success('Link copied'))}><Copy className="h-3.5 w-3.5" /> Copy</button>
            </Step>
            <Step n={2}>{HAS_BACKEND ? 'Sign in with the same account on both devices.' : 'This deployment has no server, so each device keeps its own data. Ask the admin to connect the FocusNest API for real sync.'}</Step>
            <Step n={3}>Add it to your Home Screen. <Link to="/install" className="font-semibold text-teal">See how →</Link></Step>
            <Step n={4}>Turn on notifications in Settings to hear about breaks even when the app is closed.</Step>
          </ol>
        </Card>
        <Card>
          <CardHeader title="Sync status" />
          {mode === 'account' ? (
            <p className="flex items-center gap-2">{sync.status === 'connected' ? <CircleCheck className="h-5 w-5 text-success" /> : <span className="h-3 w-3 rounded-full bg-warning" />}
              {sync.status === 'connected' ? 'Realtime sync is on. Your break timer is shared across your devices.' : 'Reconnecting… we will keep checking every few seconds.'}</p>
          ) : (
            <div className="space-y-3">
              <p className="muted">You're in guest mode, so the timer lives on this device only.</p>
              {HAS_BACKEND && <Link to="/signup"><Button>Create an account to sync</Button></Link>}
            </div>
          )}
          <p className="muted mt-4 text-xs">Honest limit: websites can't see or block other apps like Instagram or PUBG. FocusNest uses alarms, notifications and your own check-ins. Automatic focus mode and app blocking come with the Android app (Phase 3).</p>
        </Card>
      </div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-sm font-bold text-white">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
