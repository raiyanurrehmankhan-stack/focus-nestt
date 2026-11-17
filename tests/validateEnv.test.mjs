// Tests for server/src/config/validateEnv.js (dependency-free; runs without the
// server's npm packages). Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { checkJwtSecret, validateEnv } from '../server/src/config/validateEnv.js';

const strongSecret = () => randomBytes(32).toString('base64'); // = openssl rand -base64 32
const prodEnv = (extra = {}) => ({
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/focusnest',
  JWT_SECRET: strongSecret(),
  CORS_ORIGIN: 'https://focus-nestt.vercel.app',
  ...extra,
});
const devEnv = (extra = {}) => ({ NODE_ENV: 'development', MONGO_URI: 'mongodb://localhost:27017/focusnest', ...extra });
const noSecretIn = (messages, secret) => messages.every((m) => !m.includes(secret));

// ---------------- JWT ----------------
test('a complete, safe production config has no errors', () => {
  const { errors, config } = validateEnv(prodEnv());
  assert.deepEqual(errors, []);
  assert.equal(config.isProd, true);
  assert.equal(config.vapid.enabled, false);
  assert.equal(config.smtp.enabled, false);
});

test('JWT: empty secret is rejected in production', () => {
  for (const value of [undefined, '', '   ']) {
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: value }));
    assert.ok(errors.some((e) => e.includes('JWT_SECRET is empty') && e.includes('openssl rand -base64 32')), `value ${JSON.stringify(value)}`);
  }
});

test('JWT: placeholder secrets are rejected even when long enough', () => {
  const placeholders = ['change-me-to-a-long-random-string', 'changeme-changeme-changeme-12345678', 'your-secret-goes-here-1234567890abcd', 'example-secret-ABCDEFGHIJKLMNOPQRSTUV'];
  for (const p of placeholders) {
    assert.ok(p.length >= 32, 'precondition: placeholder meets the length requirement');
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: p }));
    assert.ok(errors.some((e) => e.includes('placeholder')), p);
    assert.ok(noSecretIn(errors, p), 'secret value must not appear in messages');
  }
  assert.ok(checkJwtSecret('secret').some((m) => m.includes('well-known')));
  assert.ok(checkJwtSecret('PASSWORD').some((m) => m.includes('well-known')));
});

test('JWT: too-short secret is rejected', () => {
  const s = randomBytes(12).toString('base64'); // 16 chars
  const { errors } = validateEnv(prodEnv({ JWT_SECRET: s }));
  assert.ok(errors.some((e) => e.includes('too short')));
  assert.ok(noSecretIn(errors, s));
});

test('JWT: low-variety secret is rejected', () => {
  for (const s of ['a'.repeat(64), 'abababababababababababababababababab', '0123456789'.slice(0, 9).repeat(5)]) {
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: s }));
    assert.ok(errors.some((e) => e.includes('too little variety')), s);
  }
});

test('JWT: a valid random secret is accepted', () => {
  for (let i = 0; i < 20; i++) assert.deepEqual(checkJwtSecret(strongSecret()), []);
});

test('JWT: development is convenient, production is strict', () => {
  const missing = validateEnv(devEnv());
  assert.deepEqual(missing.errors, []);
  assert.ok(missing.config.jwtSecret && missing.config.jwtSecret.length >= 32, 'temporary random secret in development');
  assert.ok(missing.warnings.some((w) => w.includes('temporary random secret')));

  const weak = validateEnv(devEnv({ JWT_SECRET: 'change-me-to-a-long-random-string' }));
  assert.deepEqual(weak.errors, []);
  assert.ok(weak.warnings.some((w) => w.includes('development only')));
  assert.ok(noSecretIn(weak.warnings, 'change-me-to-a-long-random-string'));

  assert.ok(validateEnv(prodEnv({ JWT_SECRET: 'change-me-to-a-long-random-string' })).errors.length > 0);
});

test('MONGO_URI is required', () => {
  assert.ok(validateEnv(prodEnv({ MONGO_URI: '' })).errors.some((e) => e.includes('MONGO_URI')));
  assert.ok(validateEnv({ NODE_ENV: 'development' }).errors.some((e) => e.includes('MONGO_URI')));
});

// ---------------- CORS (through validateEnv) ----------------
test('CORS: missing production CORS_ORIGIN stops start-up; matcher is exposed', () => {
  assert.ok(validateEnv(prodEnv({ CORS_ORIGIN: '' })).errors.some((e) => e.includes('CORS_ORIGIN is required in production')));
  const { config } = validateEnv(prodEnv());
  assert.equal(config.isOriginAllowed('https://focus-nestt.vercel.app'), true);
  assert.equal(config.isOriginAllowed('https://focus-nestt.vercel.app.evil.com'), false);
});

test('CORS: a vercel.app pattern triggers a warning', () => {
  const { errors, warnings } = validateEnv(prodEnv({ CORS_ORIGIN_PATTERNS: 'https://focus-nestt-*-myteam.vercel.app' }));
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes('vercel.app')));
});

// ---------------- Push sender ----------------
const VAPID = { VAPID_PUBLIC_KEY: 'BPublicKeyForTestsOnly_abcdefghijklmnopqrstuvwxyz0123456789', VAPID_PRIVATE_KEY: 'PrivateKeyForTestsOnly_0123456789abcdef' };

test('push: missing VAPID_SUBJECT disables push with a warning (no invented sender)', () => {
  for (const env of [prodEnv(VAPID), devEnv(VAPID)]) {
    const { errors, warnings, config } = validateEnv(env);
    assert.deepEqual(errors, []);
    assert.equal(config.vapid.enabled, false);
    assert.equal(config.vapid.publicKey, '', 'public key is not advertised while push is disabled');
    assert.ok(warnings.some((w) => w.includes('VAPID_SUBJECT is missing')));
  }
});

test('push: valid mailto: and https: subjects are accepted', () => {
  for (const subject of ['mailto:shameer@my-own-domain.pk', 'https://focus-nestt.vercel.app']) {
    const { errors, config } = validateEnv(prodEnv({ ...VAPID, VAPID_SUBJECT: subject }));
    assert.deepEqual(errors, [], subject);
    assert.equal(config.vapid.enabled, true);
    assert.equal(config.vapid.subject, subject);
  }
});

test('push: invalid or placeholder subjects are rejected in production', () => {
  for (const subject of ['admin@focusnest.app', 'mailto:not-an-email', 'http://focus-nestt.vercel.app', 'mailto:you@example.com', 'https://yourdomain.com']) {
    const { errors } = validateEnv(prodEnv({ ...VAPID, VAPID_SUBJECT: subject }));
    assert.ok(errors.length > 0, subject);
  }
});

test('push: only one VAPID key set is an error in production', () => {
  assert.ok(validateEnv(prodEnv({ VAPID_PUBLIC_KEY: VAPID.VAPID_PUBLIC_KEY, VAPID_SUBJECT: 'https://focus-nestt.vercel.app' })).errors.length > 0);
});

// ---------------- Email sender ----------------
const SMTP = { SMTP_HOST: 'smtp.provider.test', SMTP_USER: 'apikey', SMTP_PASS: 'smtp-password-value' };

test('email: SMTP completely disabled is fine and sends nothing', () => {
  for (const env of [prodEnv(), devEnv(), prodEnv({ MAIL_FROM: 'FocusNest <no-reply@my-own-domain.pk>' })]) {
    const { errors, config } = validateEnv(env);
    assert.deepEqual(errors, []);
    assert.equal(config.smtp.enabled, false);
  }
});

test('email: SMTP enabled without MAIL_FROM fails safely in production', () => {
  const { errors, config } = validateEnv(prodEnv(SMTP));
  assert.ok(errors.some((e) => e.includes('MAIL_FROM is missing')));
  assert.equal(config.smtp.enabled, false);
  assert.ok(noSecretIn(errors, SMTP.SMTP_PASS));
  const dev = validateEnv(devEnv(SMTP));
  assert.deepEqual(dev.errors, []);
  assert.equal(dev.config.smtp.enabled, false, 'development disables email instead of guessing a sender');
});

test('email: valid MAIL_FROM enables SMTP; placeholder domains are rejected in production', () => {
  const ok = validateEnv(prodEnv({ ...SMTP, MAIL_FROM: 'FocusNest <no-reply@my-own-domain.pk>' }));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.config.smtp.enabled, true);
  assert.equal(ok.config.smtp.from, 'FocusNest <no-reply@my-own-domain.pk>');
  for (const from of ['FocusNest <no-reply@example.com>', 'no-reply@yourdomain.com', 'not an address']) {
    assert.ok(validateEnv(prodEnv({ ...SMTP, MAIL_FROM: from })).errors.length > 0, from);
  }
});

test('email: partly configured SMTP is refused in production', () => {
  assert.ok(validateEnv(prodEnv({ SMTP_HOST: 'smtp.provider.test', MAIL_FROM: 'a@my-own-domain.pk' })).errors.some((e) => e.includes('partly configured')));
});

test('no hard-coded sender domain remains in the server', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../server/src', import.meta.url).pathname;
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const hits = walk(root).filter((f) => readFileSync(f, 'utf8').includes('focusnest.app'));
  assert.deepEqual(hits, []);
});
