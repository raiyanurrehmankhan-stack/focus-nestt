import { CircleCheck, Download, Globe, Monitor, Share, Smartphone, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { isIOS } from '../services/device.js';
import { promptInstall } from '../services/pwa.js';
import { useAppStore } from '../store/useAppStore.js';

const guess = () => {
  const ua = navigator.userAgent;
  if (isIOS()) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};

/** Installation help for Android, iPhone/iPad and desktop browsers. */
export default function Install() {
  const install = useAppStore((s) => s.install);
  const [platform, setPlatform] = useState(guess);
  return (
    <div className="page grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <Segmented ariaLabel="Your device" value={platform} onChange={setPlatform} options={[{ value: 'android', label: 'Android' }, { value: 'ios', label: 'iPhone / iPad' }, { value: 'desktop', label: 'Laptop / Desktop' }]} />
        <div className="mt-6">
          {platform === 'android' && (
            <Steps icon={Smartphone} title="Android (Chrome, Edge, Samsung Internet)" steps={[
              'Open FocusNest in Chrome.',
              <>Tap <strong>Install app</strong> when it appears, or open the menu <strong>⋮</strong> and choose <strong>Install app</strong> (older versions: <strong>Add to Home screen</strong>).</>,
              <>Tap <strong>Install</strong>. FocusNest appears on your home screen and in your app drawer.</>,
              'Open it from the home screen — it runs full screen like a normal app.',
              'In Settings, turn on notifications so break alarms reach you even when the app is closed.',
            ]} />
          )}
          {platform === 'ios' && (
            <Steps icon={Share} title="iPhone and iPad (Safari)" steps={[
              <>Open FocusNest in <strong>Safari</strong> (on iOS 16.4+ Chrome and Edge also work).</>,
              <>Tap the <strong>Share</strong> button <Share className="inline h-4 w-4" aria-label="share icon" /> at the bottom (iPad: top right).</>,
              <>Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus className="inline h-4 w-4" aria-hidden />.</>,
              <>Keep the name <strong>FocusNest</strong> and tap <strong>Add</strong>.</>,
              'Open FocusNest from the Home Screen icon, then turn on notifications in Settings. On iPhone, notifications only work from the Home Screen app (iOS 16.4 or later).',
            ]} />
          )}
          {platform === 'desktop' && (
            <Steps icon={Monitor} title="Windows, macOS, Linux, ChromeOS (Chrome or Edge)" steps={[
              'Open FocusNest in Chrome or Microsoft Edge.',
              <>Click the <strong>Install</strong> icon <Download className="inline h-4 w-4" aria-hidden /> at the right end of the address bar — or use the <strong>Install app</strong> button in FocusNest's top bar.</>,
              <>Confirm with <strong>Install</strong>. FocusNest opens in its own window and is added to your Start menu, Dock or app launcher.</>,
              'Safari on macOS Sonoma or later: File → Add to Dock.',
              'Firefox does not support installing web apps on desktop; FocusNest still works fully in a normal tab.',
            ]} />
          )}
        </div>
      </Card>
      <aside className="space-y-5">
        <Card className="text-center">
          {install.installed ? (
            <p className="flex flex-col items-center gap-2 font-semibold"><CircleCheck className="h-10 w-10 text-success" /> FocusNest is installed on this device.</p>
          ) : install.canPrompt ? (
            <>
              <p className="mb-4">Your browser can install FocusNest right now.</p>
              <Button size="lg" className="w-full" onClick={promptInstall}><Download className="h-5 w-5" /> Install FocusNest</Button>
            </>
          ) : (
            <p className="muted text-sm"><Globe className="mx-auto mb-2 h-8 w-8" />Follow the steps for your device. If you don't see an install option, make sure you're using a supported browser and not a private window.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="What works offline" />
          <ul className="space-y-2 text-sm">
            <li>✓ The app opens without internet</li>
            <li>✓ Focus and break timers with alarms</li>
            <li>✓ Guest mode: check-ins, sleep, wins, quests</li>
            <li>✓ Signed in: your last synced data, read-only</li>
            <li className="muted">✗ Syncing devices and push notifications need a connection</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function Steps({ icon: Icon, title, steps }) {
  return (
    <section>
      <CardHeader title={title} icon={Icon} />
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-sm font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
