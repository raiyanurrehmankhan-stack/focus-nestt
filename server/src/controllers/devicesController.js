import { Device } from '../models/index.js';
import { connectedDeviceIds } from '../services/realtime.js';
import { pushEnabled, pushPublicKey, sendToUser } from '../services/pushService.js';

const pub = (d, online) => ({ deviceId: d.deviceId, type: d.type, label: d.label, lastSeenAt: d.lastSeenAt, push: Boolean(d.pushSubscription?.endpoint), online: online.has(d.deviceId) });

export async function listDevices(req, res) {
  const online = connectedDeviceIds(req.userId);
  const items = await Device.find({ userId: req.userId }).sort({ lastSeenAt: -1 }).lean();
  res.json({ items: items.map((d) => pub(d, online)) });
}

export async function registerDevice(req, res) {
  const { deviceId, type, label, pushSubscription } = req.body;
  const update = { type, label, lastSeenAt: new Date() };
  const ops = { $set: update };
  if (pushSubscription) update.pushSubscription = pushSubscription;
  else if (pushSubscription === null) ops.$unset = { pushSubscription: 1 };
  // A push subscription belongs to exactly one device record.
  if (pushSubscription?.endpoint) await Device.updateMany({ 'pushSubscription.endpoint': pushSubscription.endpoint, deviceId: { $ne: deviceId } }, { $unset: { pushSubscription: 1 } });
  const count = await Device.countDocuments({ userId: req.userId });
  const exists = await Device.exists({ userId: req.userId, deviceId });
  if (!exists && count >= 10) return res.status(409).json({ error: 'You can connect up to 10 devices. Remove an old one in Settings first.' });
  const d = await Device.findOneAndUpdate({ userId: req.userId, deviceId }, ops, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  res.status(201).json({ device: pub(d, connectedDeviceIds(req.userId)) });
}

export async function removeDevice(req, res) {
  await Device.deleteOne({ userId: req.userId, deviceId: req.params.deviceId });
  res.json({ ok: true });
}

export function publicKey(_req, res) {
  res.json({ enabled: pushEnabled, publicKey: pushPublicKey() });
}

export async function testPush(req, res) {
  if (!pushEnabled) return res.status(503).json({ error: 'Push notifications are not configured on the server yet.' });
  const r = await sendToUser(req.userId, { title: 'FocusNest test 🔔', body: 'Notifications are working on this device.', tag: 'test', url: '/settings' }, { onlyOffline: false });
  if (!r.sent) return res.status(409).json({ error: 'No device has notifications turned on yet. Enable them in Settings first.' });
  res.json({ ok: true, sent: r.sent });
}
