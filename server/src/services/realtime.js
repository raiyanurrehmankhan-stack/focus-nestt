// Holds the Socket.IO server and tracks which devices are connected, so
// services can broadcast to a user's room and push only to offline devices.
let io = null;
const connected = new Map(); // userId -> Map(socketId -> deviceId)

export const setIO = (server) => { io = server; };
export const room = (userId) => `user:${userId}`;

export function emitToUser(userId, event, payload) {
  if (io) io.to(room(String(userId))).emit(event, payload);
}

export function trackConnect(userId, socketId, deviceId) {
  const key = String(userId);
  if (!connected.has(key)) connected.set(key, new Map());
  connected.get(key).set(socketId, deviceId || null);
}
export function trackDisconnect(userId, socketId) {
  const m = connected.get(String(userId));
  if (!m) return;
  m.delete(socketId);
  if (!m.size) connected.delete(String(userId));
}
export function connectedDeviceIds(userId) {
  const m = connected.get(String(userId));
  return new Set(m ? [...m.values()].filter(Boolean) : []);
}
export function connectedCount(userId) {
  return connected.get(String(userId))?.size || 0;
}
