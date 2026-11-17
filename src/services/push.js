// Web Push subscription for this device (Phase 2). On iPhone/iPad, push
// only works after FocusNest is added to the Home Screen (iOS 16.4+).
import { api } from './api.js';
import { getDeviceId, getDeviceLabel, getDeviceType, isIOS, isStandalone } from './device.js';
import { requestNotificationPermission } from './notifications.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushNeedsInstall = () => isIOS() && !isStandalone();

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Ask permission (after the consent screen), subscribe and register the device. */
export async function enablePush() {
  if (pushNeedsInstall()) throw new Error('On iPhone and iPad, add FocusNest to your Home Screen first, then turn on notifications from the installed app.');
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser or system settings, then try again.');
  const { enabled, publicKey } = await api.pushPublicKey();
  if (!enabled || !publicKey) throw new Error('Push notifications are not configured on the server yet.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await api.registerDevice({ deviceId: getDeviceId(), type: getDeviceType(), label: getDeviceLabel(), pushSubscription: sub.toJSON() });
  return true;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) await sub.unsubscribe().catch(() => {});
  await api.registerDevice({ deviceId: getDeviceId(), type: getDeviceType(), label: getDeviceLabel(), pushSubscription: null });
}

/** Keeps the server's copy of this device's subscription fresh. */
export async function refreshPushRegistration() {
  const sub = await currentSubscription().catch(() => null);
  await api.registerDevice({ deviceId: getDeviceId(), type: getDeviceType(), label: getDeviceLabel(), ...(sub ? { pushSubscription: sub.toJSON() } : {}) }).catch(() => {});
}
