// Local notifications on this device (laptop: Notification API, doc 6.6).
// Background notifications for other devices come from Web Push (push.js).
export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function showLocalNotification(title, { body, tag, url = '/', requireInteraction = false } = {}) {
  if (notificationPermission() !== 'granted') return false;
  // Do not stack a notification on top of the visible app.
  if (document.visibilityState === 'visible' && document.hasFocus()) return false;
  const options = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url }, requireInteraction, renotify: Boolean(tag) };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return true; }
    new Notification(title, options); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
}
