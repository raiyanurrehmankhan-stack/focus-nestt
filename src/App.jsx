import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BreakOverOverlay } from './components/focus/BreakOverOverlay.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { NotificationConsent } from './components/pwa/NotificationConsent.jsx';
import { UpdatePrompt } from './components/pwa/UpdatePrompt.jsx';
import { Logo } from './components/ui/Logo.jsx';
import { Toaster } from './components/ui/Toaster.jsx';
import { useZeroWatcher } from './hooks/useCountdown.js';
import { useTheme } from './hooks/useTheme.js';
import { appRoutes } from './routes.jsx';
import { isAccountMode } from './services/api.js';
import { reloadLocalDb, LOCAL_DB_KEY } from './services/localApi.js';
import { showLocalNotification } from './services/notifications.js';
import { initPWA } from './services/pwa.js';
import { loadSession, signOut } from './services/session.js';
import { socketConnected } from './services/socket.js';
import { playAlarm } from './services/sound.js';
import { backToFocus, handleZero, refreshTimer } from './services/timerActions.js';
import { useAppStore } from './store/useAppStore.js';
import { isBreakOver, useTimerStore } from './store/useTimerStore.js';
import { toast } from './store/useToastStore.js';

const Onboarding = lazy(() => import('./pages/Onboarding.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  useTheme();
  const navigate = useNavigate();
  const ready = useAppStore((s) => s.ready);
  const user = useAppStore((s) => s.user);
  const bootError = useAppStore((s) => s.bootError);
  const active = useTimerStore((s) => s.active);
  useBootstrap(navigate);
  useTimerEffects();
  useSyncFallback();
  // One global countdown watcher: when the running timer reaches zero on any
  // screen, finish the focus session or show the Break Over overlay.
  useZeroWatcher(user ? active : null, handleZero);

  if (!ready) return <Splash />;
  if (bootError) return <BootError message={bootError} />;

  return (
    <>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/signin" element={<Auth mode="signin" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          {!user ? (
            <>
              <Route path="/welcome" element={<Onboarding />} />
              <Route path="*" element={<Navigate to="/welcome" replace />} />
            </>
          ) : (
            <>
              <Route path="/welcome" element={<Navigate to="/" replace />} />
              <Route element={<AppShell />}>
                {appRoutes.map(({ path, element: Page }) => <Route key={path} path={path} element={<Page />} />)}
                <Route path="*" element={<NotFound />} />
              </Route>
            </>
          )}
        </Routes>
      </Suspense>
      {user && isBreakOver(active) && <BreakOverOverlay timer={active} />}
      <Toaster />
      <UpdatePrompt />
      <NotificationConsent />
    </>
  );
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center" aria-busy="true" aria-label="Loading FocusNest">
      <div className="flex flex-col items-center gap-3 animate-fadeIn"><Logo size={88} vertical /><span className="muted text-sm">Track it. Control it. Replace it.</span></div>
    </div>
  );
}

function BootError({ message }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-sm text-center">
        <Logo size={64} vertical />
        <h1 className="mt-4 font-display text-xl font-semibold">We can't reach FocusNest right now</h1>
        <p className="muted mt-2 text-sm">{message} Check your connection and try again.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className="rounded-full bg-teal px-5 py-3 font-semibold text-white" onClick={() => loadSession()}>Try again</button>
          <button type="button" className="rounded-full px-5 py-3 font-semibold text-teal-700 dark:text-teal-200" onClick={() => signOut({ silent: true })}>Use guest mode on this device</button>
        </div>
      </div>
    </div>
  );
}

function useBootstrap(navigate) {
  useEffect(() => {
    const app = useAppStore.getState();
    initPWA({
      onNavigate: (url, action) => {
        navigate(url);
        if (action === 'focus') backToFocus();
      },
    });
    loadSession().finally(() => app.setReady(true));

    const online = () => { app.setOnline(true); if (isAccountMode()) loadSession(); };
    const offline = () => app.setOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    // Keep guest data in sync between tabs.
    const storage = (e) => {
      if (e.key === LOCAL_DB_KEY && !isAccountMode()) { reloadLocalDb(); refreshTimer(); }
    };
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('storage', storage); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Alarm, notification and celebration when a timer changes state (doc 6.5). */
function useTimerEffects() {
  const active = useTimerStore((s) => s.active);
  const lastFinished = useTimerStore((s) => s.lastFinished);
  const soundOn = useAppStore((s) => s.user?.soundOn !== false);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!isBreakOver(active)) return;
    const key = `${active.id}:${active.endAt}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    if (soundOn) playAlarm({ repeat: 2 });
    navigator.vibrate?.([300, 120, 300]);
    showLocalNotification('Break over ⏰', { body: 'Time to get back to focus.', tag: 'break-over', url: '/focus', requireInteraction: true });
  }, [active, soundOn]);

  useEffect(() => {
    if (!lastFinished || seen.current.has(`done:${lastFinished.id}`)) return;
    seen.current.add(`done:${lastFinished.id}`);
    toast.points(`Focus session complete! +${lastFinished.points || 0} points 🎉`);
    if (soundOn) playAlarm({ repeat: 1 });
    showLocalNotification('Focus session complete 🎉', { body: `Great work! +${lastFinished.points || 0} points.`, tag: 'focus-complete', url: '/focus' });
  }, [lastFinished, soundOn]);
}

/** If the realtime connection drops, poll the server so devices stay in sync. */
function useSyncFallback() {
  useEffect(() => {
    const tick = () => {
      if (!isAccountMode() || document.visibilityState !== 'visible') return;
      if (!socketConnected()) refreshTimer();
    };
    const id = setInterval(tick, 15000);
    const vis = () => { if (document.visibilityState === 'visible' && isAccountMode()) refreshTimer(); };
    const push = () => refreshTimer();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('fn:push', push);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); window.removeEventListener('fn:push', push); };
  }, []);
}
