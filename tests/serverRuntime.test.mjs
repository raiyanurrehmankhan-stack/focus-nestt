// Server runtime behaviour that can be tested without the server's npm
// packages: start-up exit behaviour (real env.js in a child process), and
// push / email setup with fake libraries.
// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createECDH, randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyConfig } from '../server/src/config/startup.js';
import { validateEnv } from '../server/src/config/validateEnv.js';
import { buildBuddyEmail, createMailTransport } from '../server/src/services/mailSetup.js';
import { initPush } from '../server/src/services/pushSetup.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const fakeLog = () => {
  const lines = { warn: [], error: [] };
  return { lines, log: { warn: (m) => lines.warn.push(m), error: (m) => lines.error.push(m) } };
};
const strongSecret = () => randomBytes(32).toString('base64');

// ---------------- applyConfig (exit behaviour, in-process) ----------------
test('applyConfig: errors print a clear message and exit(1) exactly once', () => {
  const { lines, log } = fakeLog();
  const exits = [];
  const placeholder = 'change-me-to-a-long-random-string';
  const result = applyConfig(validateEnv({ NODE_ENV: 'production', MONGO_URI: 'mongodb://x', JWT_SECRET: placeholder }), { log, exit: (c) => exits.push(c) });
  assert.deepEqual(exits, [1]);
  assert.equal(result, null);
  assert.ok(lines.error.some((l) => l.includes('cannot start')));
  assert.ok(lines.error.some((l) => l.includes('CORS_ORIGIN is required')));
  assert.ok(lines.error.every((l) => !l.includes(placeholder)), 'secret not printed');
});

test('applyConfig: a valid config starts without exiting and prints warnings', () => {
  const { lines, log } = fakeLog();
  const exits = [];
  const config = applyConfig(validateEnv({ NODE_ENV: 'development', MONGO_URI: 'mongodb://x' }), { log, exit: (c) => exits.push(c) });
  assert.deepEqual(exits, []);
  assert.equal(config.nodeEnv, 'development');
  assert.ok(lines.warn.length >= 2);
});

// ---------------- real env.js start-up in a child process ----------------
// Runs the actual server/src/config/env.js. If the real `dotenv` package is
// not installed (this workspace cannot download packages), a stand-in that
// loads nothing is used: env.js only needs `dotenv/config` to load a .env file,
// and these tests pass all variables directly.
function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'fn-startup-'));
  cpSync(join(root, 'server/src'), join(dir, 'server/src'), { recursive: true });
  cpSync(join(root, 'shared'), join(dir, 'shared'), { recursive: true });
  writeFileSync(join(dir, 'server/package.json'), '{"type":"module"}');
  const realDotenv = join(root, 'server/node_modules/dotenv');
  if (existsSync(realDotenv)) {
    cpSync(realDotenv, join(dir, 'server/node_modules/dotenv'), { recursive: true });
  } else {
    mkdirSync(join(dir, 'server/node_modules/dotenv'), { recursive: true });
    writeFileSync(join(dir, 'server/node_modules/dotenv/package.json'), '{"name":"dotenv","type":"module","exports":{"./config":"./config.js"}}');
    writeFileSync(join(dir, 'server/node_modules/dotenv/config.js'), '// stand-in: loads nothing\n');
  }
  return dir;
}
const sandbox = makeSandbox();
test.after(() => rmSync(sandbox, { recursive: true, force: true }));

function start(vars) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', "const { env } = await import('./server/src/config/env.js'); console.log('STARTED ' + env.nodeEnv + ' prod=' + env.isProd);"], {
    cwd: sandbox, env: { PATH: process.env.PATH, ...vars }, encoding: 'utf8', timeout: 20000,
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const BASE = { MONGO_URI: 'mongodb://127.0.0.1:27017/fn', CORS_ORIGIN: 'https://focus-nestt.vercel.app' };

test('startup: production with a placeholder JWT secret exits 1 without printing it', () => {
  const r = start({ ...BASE, NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-long-random-string' });
  assert.equal(r.code, 1);
  assert.match(r.err, /looks like a placeholder/);
  assert.ok(!r.err.includes('change-me-to-a-long-random-string') && !r.out.includes('change-me-to-a-long-random-string'));
  assert.doesNotMatch(r.out, /STARTED/);
});

test('startup: unset NODE_ENV applies production rules (placeholder refused)', () => {
  const r = start({ ...BASE, JWT_SECRET: 'change-me-to-a-long-random-string' });
  assert.equal(r.code, 1);
  assert.match(r.err, /NODE_ENV is not set; applying production rules/);
});

test('startup: NODE_ENV="Production" is refused', () => {
  const r = start({ ...BASE, NODE_ENV: 'Production', JWT_SECRET: strongSecret() });
  assert.equal(r.code, 1);
  assert.match(r.err, /NODE_ENV="Production" is not supported/);
});

test('startup: production without CORS_ORIGIN exits 1', () => {
  const r = start({ MONGO_URI: 'mongodb://x', NODE_ENV: 'production', JWT_SECRET: strongSecret() });
  assert.equal(r.code, 1);
  assert.match(r.err, /CORS_ORIGIN is required in production/);
});

test('startup: production with SMTP but no MAIL_FROM exits 1', () => {
  const r = start({ ...BASE, NODE_ENV: 'production', JWT_SECRET: strongSecret(), SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'smtp-pass-123' });
  assert.equal(r.code, 1);
  assert.match(r.err, /MAIL_FROM is missing/);
  assert.ok(!r.err.includes('smtp-pass-123'));
});

test('startup: a valid production configuration starts', () => {
  const r = start({ ...BASE, NODE_ENV: 'production', JWT_SECRET: strongSecret() });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /STARTED production prod=true/);
});

test('startup: development starts with only MONGO_URI and explains the temporary secret', () => {
  const r = start({ MONGO_URI: 'mongodb://x', NODE_ENV: 'development' });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /STARTED development prod=false/);
  assert.match(r.err, /changes on every restart, which signs everyone out/);
});

// ---------------- push setup ----------------
function fakeWebpush({ throws = false } = {}) {
  const calls = [];
  return {
    calls,
    setVapidDetails(...args) {
      calls.push(args);
      if (throws) throw new Error(`Vapid public key should be 65 bytes long when decoded. ${args.join(' ')}`);
    },
  };
}
function realKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: ecdh.getPrivateKey().toString('base64url') };
}

test('push setup: disabled config never calls web-push', () => {
  const wp = fakeWebpush();
  const { lines, log } = fakeLog();
  assert.equal(initPush(wp, { enabled: false }, log), false);
  assert.equal(wp.calls.length, 0);
  assert.equal(lines.warn.length, 1);
});

test('push setup: enabled config is applied exactly once', () => {
  const wp = fakeWebpush();
  const k = realKeys();
  const { log } = fakeLog();
  assert.equal(initPush(wp, { enabled: true, subject: 'https://focus-nestt.vercel.app', ...k }, log), true);
  assert.deepEqual(wp.calls, [['https://focus-nestt.vercel.app', k.publicKey, k.privateKey]]);
});

test('push setup: if web-push rejects the config, push is disabled without crashing or leaking keys', () => {
  const wp = fakeWebpush({ throws: true });
  const k = realKeys();
  const { lines, log } = fakeLog();
  let result;
  assert.doesNotThrow(() => { result = initPush(wp, { enabled: true, subject: 'mailto:me@my-own-domain.pk', ...k }, log); });
  assert.equal(result, false);
  assert.equal(wp.calls.length, 1);
  assert.equal(lines.error.length, 1);
  assert.ok(!lines.error[0].includes(k.privateKey) && !lines.error[0].includes(k.publicKey) && !lines.error[0].includes('me@my-own-domain.pk'));
});

// ---------------- email setup ----------------
function fakeNodemailer({ throws = false } = {}) {
  const calls = [];
  return { calls, createTransport(opts) { calls.push(opts); if (throws) throw new Error('bad host'); return { sendMail: async () => {} }; } };
}

test('email setup: disabled SMTP creates no transport', () => {
  const nm = fakeNodemailer();
  assert.equal(createMailTransport(nm, { enabled: false }), null);
  assert.equal(nm.calls.length, 0);
});

test('email setup: SMTP without MAIL_FROM never creates a transport (end to end through validateEnv)', () => {
  const nm = fakeNodemailer();
  const { config } = validateEnv({ NODE_ENV: 'development', MONGO_URI: 'mongodb://x', SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p' });
  assert.equal(config.smtp.enabled, false);
  assert.equal(createMailTransport(nm, config.smtp), null);
  assert.equal(nm.calls.length, 0);
});

test('email setup: fully configured SMTP creates one transport with the configured settings', () => {
  const nm = fakeNodemailer();
  const { config } = validateEnv({ NODE_ENV: 'production', MONGO_URI: 'mongodb://x', JWT_SECRET: strongSecret(), CORS_ORIGIN: 'https://focus-nestt.vercel.app', SMTP_HOST: 'smtp.test', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'FocusNest <no-reply@my-own-domain.pk>' });
  const transport = createMailTransport(nm, config.smtp);
  assert.ok(transport);
  assert.deepEqual(nm.calls, [{ host: 'smtp.test', port: 465, secure: true, auth: { user: 'u', pass: 'p' } }]);
});

test('email setup: a transport error disables email instead of crashing', () => {
  const nm = fakeNodemailer({ throws: true });
  const { lines, log } = fakeLog();
  assert.equal(createMailTransport(nm, { enabled: true, host: 'h', port: 587, user: 'u', pass: 'secret-pass' }, log), null);
  assert.equal(lines.error.length, 1);
  assert.ok(!lines.error[0].includes('secret-pass'));
});

test('buddy email says THAT a break was extended, never why', () => {
  const msg = buildBuddyEmail({ name: 'Sana', buddyEmail: 'friend@my-own-domain.pk' }, 5, { from: 'FocusNest <no-reply@my-own-domain.pk>', appUrl: 'https://focus-nestt.vercel.app' });
  assert.equal(msg.to, 'friend@my-own-domain.pk');
  assert.equal(msg.from, 'FocusNest <no-reply@my-own-domain.pk>');
  assert.match(msg.subject, /Sana extended a break/);
  assert.match(msg.text, /5 minutes/);
  assert.doesNotMatch(msg.text, /reason|because/i);
});
