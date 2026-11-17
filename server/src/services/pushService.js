import webpush from 'web-push';
import { env } from '../config/env.js';
import { Device } from '../models/index.js';
import { connectedDeviceIds } from './realtime.js';

// Enabled only when both VAPID keys AND a valid VAPID_SUBJECT are configured
// (checked in config/validateEnv.js). There is no built-in sender default.
export const pushEnabled = env.vapid.enabled;
if (pushEnabled) webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
else console.warn('[push] Web Push is disabled. To enable it set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npm run vapid) and VAPID_SUBJECT.');

/**
 * Sends a Web Push notification to a user's devices.
 * By default devices that are currently connected over Socket.IO are skipped
 * (they already got the realtime event), matching the doc's section 7.6.
 */
export async function sendToUser(userId, payload, { onlyOffline = true, deviceFilter = null } = {}) {
  if (!pushEnabled) return { sent: 0, skipped: 'disabled' };
  const online = onlyOffline ? connectedDeviceIds(userId) : new Set();
  const devices = await Device.find({ userId, 'pushSubscription.endpoint': { $exists: true, $ne: null } }).lean();
  let sent = 0;
  await Promise.all(devices.map(async (d) => {
    if (online.has(d.deviceId)) return;
    if (deviceFilter && !deviceFilter(d)) return;
    try {
      const { endpoint, keys } = d.pushSubscription;
      await webpush.sendNotification({ endpoint, keys: { p256dh: keys?.p256dh, auth: keys?.auth } }, JSON.stringify(payload), { TTL: 120, urgency: 'high', topic: payload.tag?.slice(0, 32) });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or was revoked on the device.
        await Device.updateOne({ _id: d._id }, { $unset: { pushSubscription: 1 } });
      } else {
        console.warn('[push] send failed:', err.statusCode || '', err.body || err.message);
      }
    }
  }));
  return { sent };
}
