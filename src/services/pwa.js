// Service worker registration, update prompt and install prompt.
import { registerSW } from 'virtual:pwa-register';
import { useAppStore } from '../store/useAppStore.js';
import { isStandalone } from './device.js';

let updateSW = null;
let deferredPrompt = null;

export function initPWA({ onNavigate } = {}) {
  const app = useAppStore.getState();
  app.setInstall({ installed: isStandalone() });

  if ('serviceWorker' in navigator) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { useAppStore.getState().setUpdate({ available: true }); },
      onOfflineReady() { useAppStore.getState().setUpdate({ offlineReady: true }); },
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        // Check for a new version every hour and whenever the app comes back to the foreground.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      },
      onRegisterError(err) { console.warn('Service worker registration failed', err); },
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE' && onNavigate) {
        const url = new URL(event.data.url, location.origin);
        onNavigate(url.pathname + url.search, event.data.action);
      }
      if (event.data?.type === 'PUSH_RECEIVED' || event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') window.dispatchEvent(new CustomEvent('fn:push', { detail: event.data }));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own Install button instead of the mini-infobar
    deferredPrompt = e;
    useAppStore.getState().setInstall({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    useAppStore.getState().setInstall({ canPrompt: false, installed: true });
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => useAppStore.getState().setInstall({ installed: e.matches }));
}

/** Shows the browser's install dialog (Chrome/Edge/Android). */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  useAppStore.getState().setInstall({ canPrompt: false });
  return outcome;
}

/** Activates the waiting service worker and reloads into the new version. */
export function applyUpdate() {
  if (updateSW) updateSW(true);
  else location.reload();
}
