// Realtime sync (doc 7.5). Every device of a user joins `user:<userId>`, so
// laptop and phone receive the same events. The server owns the clock.
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { schemas, z } from '../config/validation.js';
import { Device, User } from '../models/index.js';
import { room, setIO, trackConnect, trackDisconnect } from '../services/realtime.js';
import { closeBreak, extendBreak, getActiveTimer, startBreak, startFocus, updateFocus } from '../services/timerService.js';
import { corsOriginOption } from '../utils/origins.js';
import { verifyToken } from '../utils/tokens.js';

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    // Same origin check as the REST API. `cors` covers HTTP long-polling;
    // `allowRequest` also covers WebSocket upgrades, which browsers do not
    // subject to CORS.
    cors: { origin: corsOriginOption(env.isOriginAllowed), methods: ['GET', 'POST'] },
    allowRequest: (req, cb) => cb(null, env.isOriginAllowed(req.headers.origin)),
    pingInterval: 20000,
    pingTimeout: 20000,
  });
  setIO(io);

  // Authenticate the handshake with the same JWT as the REST API.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('+tokenVersion');
      if (!user || (user.tokenVersion || 0) !== payload.v) return next(new Error('unauthorized'));
      socket.data.userId = String(user._id);
      socket.data.deviceId = String(socket.handshake.auth?.deviceId || '').slice(0, 64) || null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data;
    socket.join(room(userId));
    trackConnect(userId, socket.id, socket.data.deviceId);
    io.to(room(userId)).emit('devices:changed');

    // Send the current timer so a reconnecting device catches up immediately.
    socket.emit('timer:sync', { active: await getActiveTimer(userId).catch(() => null), serverTime: Date.now() });

    const user = () => User.findById(userId);
    const handle = (event, schema, fn) => {
      socket.on(event, async (payload = {}, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          const data = schema ? schema.parse(payload) : payload;
          reply({ ok: true, ...(await fn(data)) });
        } catch (err) {
          const message = err instanceof z.ZodError ? err.issues[0]?.message : err.status ? err.message : 'Something went wrong';
          if (!err.status && !(err instanceof z.ZodError)) console.error('[socket]', event, err);
          reply({ ok: false, error: message });
        }
      });
    };

    handle('device:register', schemas.device.pick({ deviceId: true, type: true, label: true }), async (d) => {
      socket.data.deviceId = d.deviceId;
      trackConnect(userId, socket.id, d.deviceId);
      await Device.findOneAndUpdate({ userId, deviceId: d.deviceId }, { type: d.type, label: d.label, lastSeenAt: new Date() }, { upsert: true, setDefaultsOnInsert: true });
      io.to(room(userId)).emit('devices:changed');
      return {};
    });
    handle('break:start', schemas.breakStart, async (d) => ({ timer: await startBreak(await user(), d) }));
    handle('break:extend', schemas.breakExtend.extend({ breakId: schemas.objectId }), async ({ breakId, ...d }) => extendBreak(await user(), breakId, d));
    handle('break:closed', schemas.breakClose.extend({ breakId: schemas.objectId }), async ({ breakId, ...d }) => closeBreak(await user(), breakId, d));
    handle('focus:start', schemas.focusStart, async (d) => ({ timer: await startFocus(await user(), d) }));
    handle('focus:update', schemas.focusUpdate.extend({ id: schemas.objectId }), async ({ id, action }) => ({ timer: await updateFocus(await user(), id, action) }));
    handle('timer:get', null, async () => ({ active: await getActiveTimer(userId), serverTime: Date.now() }));

    socket.on('disconnect', () => {
      trackDisconnect(userId, socket.id);
      io.to(room(userId)).emit('devices:changed');
      if (socket.data.deviceId) Device.updateOne({ userId, deviceId: socket.data.deviceId }, { lastSeenAt: new Date() }).catch(() => {});
    });
  });

  return io;
}
