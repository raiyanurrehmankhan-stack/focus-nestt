// Realtime laptop <-> phone sync (doc 7.5) with Socket.IO.
import { io } from 'socket.io-client';
import { API_URL } from '../config.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { getDeviceId, getDeviceLabel, getDeviceType } from './device.js';
import { invalidate } from './events.js';
import { getToken } from './remoteApi.js';

let socket = null;

export function connectSocket() {
  if (socket || !API_URL || !getToken()) return socket;
  const app = useAppStore.getState();
  app.setSync({ status: 'connecting' });
  socket = io(API_URL, {
    auth: { token: getToken(), deviceId: getDeviceId() },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10000,
  });
  const setActive = ({ timer, active }) => useTimerStore.getState().setActive(timer !== undefined ? (isActive(timer) ? timer : null) : active);

  socket.on('connect', () => {
    useAppStore.getState().setSync({ status: 'connected' });
    socket.emit('device:register', { deviceId: getDeviceId(), type: getDeviceType(), label: getDeviceLabel() });
  });
  socket.on('disconnect', () => useAppStore.getState().setSync({ status: 'disconnected' }));
  socket.on('connect_error', (err) => useAppStore.getState().setSync({ status: err?.message === 'unauthorized' ? 'unauthorized' : 'disconnected' }));

  socket.on('timer:sync', setActive);
  for (const evt of ['focus:started', 'focus:updated', 'break:started', 'break:extended', 'break:ended']) socket.on(evt, setActive);
  socket.on('focus:ended', ({ timer, points }) => {
    const s = useTimerStore.getState();
    if (s.active?.id === timer.id) s.setActive(null);
    if (timer.status === 'completed') s.setLastFinished({ id: timer.id, kind: 'focus', points });
    invalidate('dashboard', 'focus', 'progress');
  });
  socket.on('break:closed', ({ timer }) => {
    const s = useTimerStore.getState();
    if (s.active?.id === timer.id) s.setActive(null);
    invalidate('dashboard', 'focus', 'progress');
  });
  socket.on('progress:updated', (p) => { useProgressStore.getState().apply(p); invalidate('progress', 'quests'); });
  socket.on('data:changed', ({ type }) => invalidate(type, 'dashboard'));
  socket.on('devices:changed', () => invalidate('devices'));
  return socket;
}

const isActive = (t) => t && ['running', 'paused', 'ended'].includes(t.status);

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  useAppStore.getState().setSync({ status: 'off' });
}

export const socketConnected = () => Boolean(socket?.connected);
