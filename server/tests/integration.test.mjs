// Real integration tests for CORS (Express) and origin checks (Socket.IO over
// polling and WebSocket), plus push/email disabled behaviour.
//
// Needs the server's dependencies:  cd server && npm install && npm test
// No MongoDB is required: nothing here reaches a database query.
// If the dependencies are missing, every test is reported as SKIPPED with the
// reason — never as passed.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const ALLOWED = 'https://app.focusnest.test';
const DENIED = 'https://evil.example.test';

// Configure before the server modules load (env.js reads process.env once).
// Empty strings (not deletes) so a developer's server/.env cannot fill them in.
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:1/focusnest-integration', // never connected
  JWT_SECRET: randomBytes(32).toString('base64'),
  CORS_ORIGIN: ALLOWED,
  CORS_ORIGIN_PATTERNS: '',
  VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '',
});

let deps = null;
let skip = false;
try {
  const [{ createApp }, { attachSockets }, { io: ioClient }, push, mail] = await Promise.all([
    import('../src/app.js'),
    import('../src/sockets/index.js'),
    import('socket.io-client'),
    import('../src/services/pushService.js'),
    import('../src/services/mailService.js'),
  ]);
  deps = { createApp, attachSockets, ioClient, push, mail };
} catch (err) {
  skip = `server dependencies are not installed (${err.code || 'import failed'}): run "npm install" in server/ first`;
}
const opts = skip ? { skip } : {};

let server;
let ioServer;
let base;
test.before(async () => {
  if (!deps) return;
  server = http.createServer(deps.createApp());
  ioServer = deps.attachSockets(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  if (ioServer) await new Promise((resolve) => ioServer.close(() => resolve()));
  if (server?.listening) await new Promise((resolve) => server.close(() => resolve()));
});

/** Raw HTTP request (node:http lets us set the Origin header freely). */
function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${path}`, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------------- Express CORS ----------------
test('Express: allowed origin gets CORS headers', opts, async () => {
  const r = await request('GET', '/api/health', { Origin: ALLOWED });
  assert.notEqual(r.status, 403);
  assert.equal(r.headers['access-control-allow-origin'], ALLOWED);
});

test('Express: disallowed origin is rejected with 403 and no CORS headers', opts, async () => {
  const r = await request('GET', '/api/health', { Origin: DENIED });
  assert.equal(r.status, 403);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
  assert.match(r.body, /Origin not allowed by CORS/);
});

test('Express: a disallowed origin never reaches the route handler', opts, async () => {
  const r = await request('POST', '/api/auth/login', { Origin: DENIED, 'Content-Type': 'application/json' }, JSON.stringify({ email: 'a@b.co', password: 'x' }));
  assert.equal(r.status, 403, 'blocked before validation (400) or authentication (401)');
});

test('Express: preflight from an allowed origin succeeds', opts, async () => {
  const r = await request('OPTIONS', '/api/auth/login', {
    Origin: ALLOWED, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization,x-device-id',
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers['access-control-allow-origin'], ALLOWED);
  assert.match(r.headers['access-control-allow-methods'], /POST/);
  assert.match(r.headers['access-control-allow-headers'].toLowerCase(), /authorization/);
});

test('Express: preflight from a disallowed origin is rejected', opts, async () => {
  const r = await request('OPTIONS', '/api/auth/login', { Origin: DENIED, 'Access-Control-Request-Method': 'POST' });
  assert.equal(r.status, 403);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
});

test('Express: requests without an Origin header are processed normally', opts, async () => {
  const r = await request('GET', '/api/health');
  assert.notEqual(r.status, 403);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
  assert.ok([200, 503].includes(r.status), `health answered (${r.status}; 503 = database not connected, expected here)`);
});

// ---------------- Socket.IO (polling + WebSocket) ----------------
function tryConnect(origin, transport) {
  return new Promise((resolve) => {
    const socket = deps.ioClient(base, {
      transports: [transport], extraHeaders: origin ? { Origin: origin } : {}, reconnection: false, timeout: 4000, forceNew: true,
    });
    const done = (result) => { socket.close(); resolve(result); };
    socket.on('connect', () => done({ connected: true }));
    socket.on('connect_error', (err) => done({ connected: false, message: err.message }));
  });
}

for (const transport of ['polling', 'websocket']) {
  test(`Socket.IO ${transport}: allowed origin passes the origin check (then needs sign-in)`, opts, async () => {
    const r = await tryConnect(ALLOWED, transport);
    assert.equal(r.connected, false);
    assert.equal(r.message, 'unauthorized', 'reached the JWT check, so the origin was accepted');
  });

  test(`Socket.IO ${transport}: disallowed origin is refused before authentication`, opts, async () => {
    const r = await tryConnect(DENIED, transport);
    assert.equal(r.connected, false);
    assert.notEqual(r.message, 'unauthorized', 'must be rejected by the origin check, not by the JWT check');
  });

  test(`Socket.IO ${transport}: no Origin header (non-browser client) reaches authentication`, opts, async () => {
    const r = await tryConnect(null, transport);
    assert.equal(r.connected, false);
    assert.equal(r.message, 'unauthorized');
  });
}

// ---------------- push / email disabled ----------------
test('push disabled: services report it and the public key endpoint returns none', opts, async () => {
  assert.equal(deps.push.pushEnabled, false);
  assert.equal(deps.push.pushPublicKey(), null);
  const r = await request('GET', '/api/push/public-key', { Origin: ALLOWED });
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { enabled: false, publicKey: null });
});

test('email disabled: no transport and buddy notifications are skipped', opts, async () => {
  assert.equal(deps.mail.mailEnabled, false);
  assert.equal(await deps.mail.notifyBuddy({ name: 'Sana', buddyEmail: 'friend@my-own-domain.pk' }, 5), false);
});
